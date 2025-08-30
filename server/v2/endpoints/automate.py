import datetime
from typing import cast
from common import RequestHandler, ConversationDB
from type import AutomateClient

import json
import litellm
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage
from ai.instructions.automate import T1_PROMPT, T2_PROMPT, T3_PROMPT, T4_PROMPT, T5_PROMPT
from ai.tools.automate import T1_TOOLS, T2_TOOLS, T3_TOOLS
import time
import os
import asyncio
from utils.parser import ScreenshotParser, GridParser

DEBUG = True

class AutomateRequest(RequestHandler):
    def __init__(self, state, key, client, user_id, response_id):
        super().__init__(state, key, user_id, response_id)
        self.client = cast(AutomateClient, client)
        self.conv_db = ConversationDB(
            state=self.state,
            user_id=self.user_id,
            conv_id=self.client.id,
            metadata=self.client.metadata
        )
        self.message_id = self.client.metadata.message_id
        self.request_store = {
            "text": {},
            "files": []
        }
        self.response_store = {
            "task": "",
            "taskStatus": "",
            "text": {
                "response": "",
                "execution": [],
                "validation": "",
                "output": ""
            },
            "files": [],
            "t2_reasoning": "" # only on server
        }
        self.is_first = True
        self.text_response = "" # entire text response
        self.tool_calls = {} # entire tool calls
        self.stream_text = "" # streaming text
        self.t2_tool_calls = [] # for redis
    
    async def get_client_props(self):
        redis_client_props = await self.redis.hget(self.key, "client_props")
        if redis_client_props is not None:
            if isinstance(redis_client_props, bytes):
                redis_client_props = redis_client_props.decode("utf-8")
            base_props = json.loads(redis_client_props)
        else:
            base_props = {}
        return base_props
    
    async def init_t2_messeges(self):
        await self.redis.hset(self.key, "t2_messages", json.dumps([]))
    
    async def get_t2_messeges(self):
        redis_t2_messages = await self.redis.hget(self.key, "t2_messages")
        if redis_t2_messages is not None:
            if isinstance(redis_t2_messages, bytes):
                redis_t2_messages = redis_t2_messages.decode("utf-8")
            t2_messages = json.loads(redis_t2_messages)
        else:
            t2_messages = []
        return t2_messages
    
    async def add_t2_messeges(self, new_messages):
        allowed_types = ["prompt", "response", "action.init", "action.result"]
        redis_t2_messages = await self.redis.hget(self.key, "t2_messages")
        if not redis_t2_messages:
            redis_t2_messages = []
        if isinstance(redis_t2_messages, bytes):
            redis_t2_messages = redis_t2_messages.decode("utf-8")
        t2_messages = json.loads(redis_t2_messages)
        for message in new_messages:
            if ("type" in message and message["type"] in allowed_types):
                t2_messages.append(message)
        await self.redis.hset(self.key, "t2_messages", json.dumps(t2_messages))
        return t2_messages
    
    async def async_screenshot_parse(self, image):
        def parse():
            print("F1 started:", time.perf_counter())
            annotated_image, props = ScreenshotParser.process(image)
            print("F1 ended:", time.perf_counter())
            return annotated_image, props
        
        return await asyncio.to_thread(parse)

    async def async_grid_parse(self, image):
        def parse():
            print("P1 started:", time.perf_counter())
            annotated_image, props = GridParser.process(image)
            print("P1 ended:", time.perf_counter())
            return annotated_image, props
        
        return await asyncio.to_thread(parse)
    
    async def id_to_coords(self, id, props, devicePixelRatio):
        target = next((e for e in props if e["id"] == id), None) if props else None
        if target:
            coords_x = (target["x"] + target["width"] / 2) / devicePixelRatio
            coords_y = (target["y"] + target["height"] / 2) / devicePixelRatio
            print("CONVERTING ID:", id, "  X:", coords_x, "  Y:", coords_y) if DEBUG else None
            return {"x": coords_x, "y": coords_y}
        else:
            return False

    def raise_sse_error(self, error):
        error_message = {"type": "response.error", "error": error}
        yield f"data: {json.dumps(error_message)}\n\n"
        yield "data: [DONE]"

    async def process(self):
        request_params = await self.request_handler()
        if (not request_params):
            for err in self.raise_sse_error("Invalid request"):
                yield err
            return

        if (self.client.metadata.mode == "t1" and self.client.data[-1]["type"] == "prompt"):
            # DB: Create user message
            content = self.client.data[-1]["content"]
            for data in content:
                if ("type" in data and data["type"] == "text"):
                    self.request_store["text"] = {**self.request_store["text"], "prompt": data["text"]}
                elif ("type" in data and data["type"] == "file"):
                    # Upload to bucket
                    file_name = data["payload"]["name"]
                    file_size = data["payload"]["size"]
                    file_type = data["payload"]["mimeType"]
                    file_content = data["payload"]["content"]
                    file_path = await self.conv_db.upload_file(file_content, file_type)
                    self.request_store["files"].append({
                        "type": "file",
                        "payload": {
                            "name": file_name,
                            "size": file_size,
                            "mimeType": file_type,
                            "content": file_path
                        }
                    })
            
            await self.conv_db.create_message(
                role="user",
                content=self.request_store
            )

            # DB: Create assistant message
            create_result = await self.conv_db.create_message(
                role="assistant",
                content=self.response_store,
            )
            if (create_result):
                self.message_id = create_result
            else:
                for err in self.raise_sse_error("Failed to process request"):
                    yield err
                return
            print("MESSAGE ID:", self.message_id)
        
        start_params = await self.post_handler({ "type": "response.started" }, request_params)
        if (start_params):
            yield f"data: {json.dumps(start_params)}\n\n"
        
        model = ChatOpenAI(
            model=request_params["model"] if ("model" in request_params) else None,
            temperature=request_params["temperature"] if ("temperature" in request_params) else None,
            top_p=request_params["top_p"] if ("top_p" in request_params) else None,
            reasoning_effort=request_params["reasoning_effort"] if ("reasoning_effort" in request_params) else None,
            streaming=True,
            api_key=os.environ.get("OPENAI_API_KEY"),
        ).bind_tools(request_params["tools"], parallel_tool_calls=False)

        response = model.astream(request_params["messages"])
        async for chunk in response:
            response_type = await self.response_handler(chunk, request_params)
            if (response_type):
                post_params = await self.post_handler(response_type, request_params)
                if (post_params):
                    yield f"data: {json.dumps(post_params)}\n\n"
        
        final_params = await self.post_handler("response.completed", request_params)
        if (final_params):
            yield f"data: {json.dumps(final_params)}\n\n"
        
        # Redis: Add t2 messages
        if (self.client.metadata.mode == "t2"):
            new_messages = []
            if (self.stream_text):
                new_messages.append({
                    "type": "response",
                    "content": [{ "type": "text", "text": self.text_response }]
                })
            if (self.t2_tool_calls):
                new_messages += self.t2_tool_calls
            await self.add_t2_messeges(new_messages)
        
        # DB: Update assistant message
        update_result = await self.conv_db.update_message(
            message_id=self.message_id,
            content=self.response_store,
        )
        if (not update_result):
            for err in self.raise_sse_error("Failed to process response"):
                yield err
            return
        yield "data: [DONE]"

    async def request_handler(self):
        mode = self.client.metadata.mode

        if (mode == "t1"):
            await self.init_t2_messeges() # clear t2 messages
            previous_prompt, _ = await self.conv_db.get_previous_messages()
            self.client.data = previous_prompt + self.client.data
        elif (mode == "t2"):
            if (not self.message_id): return None
            _, previous_task = await self.conv_db.get_previous_messages()
            previous_messages = await self.get_t2_messeges()
            print("PREVIOUS_MESSAGES:::", previous_messages)
            new_messages = self.client.data
            await self.add_t2_messeges(new_messages)
            self.client.data = previous_task + previous_messages + new_messages
        elif (mode == "t3" or mode == "t4"):
            if (not self.message_id): return None
            await self.init_t2_messeges() # clear t2 messages
            t2_reasoning_job = self.conv_db.get_t2_reasoning(message_id=self.message_id)
            get_task_job = self.conv_db.get_task(message_id=self.message_id)
            [t2_reasoning, task] = await asyncio.gather(t2_reasoning_job, get_task_job)
            if (t2_reasoning and task):
                prompt = f"**Task:**\n{task}\n\n**Output:**\n{t2_reasoning}"
                self.client.data = [{ "type": "prompt", "content": [{ "type": "text", "text": prompt }] }]
        else:
            return None

        if (mode == "t1"):
            model_params = {
                "model": "gpt-5",
                "tools": T1_TOOLS,
                "reasoning_effort": "minimal",
                "messages": [SystemMessage(content=T1_PROMPT)]
            }
        elif (mode == "t2"):
            model_params = {
                "model": "gpt-5",
                "tools": T2_TOOLS,
                "reasoning_effort": "medium",
                "messages": [SystemMessage(content=T2_PROMPT)]
            }
        elif (mode == "t3"):
            model_params = {
                "model": "gpt-5",
                "tools": T3_TOOLS,
                "reasoning_effort": "minimal",
                "messages": [SystemMessage(content=T3_PROMPT)]
            }
        elif (mode == "t4"):
            model_params = {
                "model": "gpt-5-mini",
                "reasoning_effort": "minimal",
                "tools": [],
                "messages": [SystemMessage(content=T4_PROMPT)]
            }
        
        request_type = None
        parser_tasks = []
        metadata = {}
        grider_tasks = []

        for index, messages in enumerate(self.client.data):
            messages = dict(messages)
            if ("type" in messages):
                if (messages["type"] == "prompt"):
                    content = []
                    for msg in messages["content"]:
                        if ("type" in msg and msg["type"] == "text"):
                            content.append({ "type": "text", "text": msg["text"] })
                        elif ("type" in msg and msg["type"] == "file"):
                            file = msg["payload"]
                            file_content = file["content"]
                            mime_type = file["mimeType"]
                            data_uri = f"data:{mime_type};base64,{file_content}"
                            if file["mimeType"].startswith("image"):
                                content.append({ "type": "image_url", "image_url": { "url": data_uri } })
                            else:
                                content.append({ "type": "file", "file": { "filename": file["name"], "file_data": data_uri } })
                    model_params["messages"].append(HumanMessage(content=content))
                elif (messages["type"] == "response"):
                    content = []
                    for msg in messages["content"]:
                        if ("type" in msg and msg["type"] == "text"):
                            content.append({ "type": "text", "text": msg["text"] })
                        elif ("type" in msg and msg["type"] == "file"):
                            file = msg["payload"]
                            file_content = file["content"]
                            mime_type = file["mimeType"]
                            data_uri = f"data:{mime_type};base64,{file_content}"
                            if file["mimeType"].startswith("image"):
                                content.append({ "type": "image_url", "image_url": { "url": data_uri } })
                            else:
                                content.append({ "type": "file", "file": { "filename": file["name"], "file_data": data_uri } })
                    model_params["messages"].append(AIMessage(content=content))
                elif (messages["type"] == "task_context"):
                    t2_reasoning = await self.conv_db.get_t2_reasoning(message_id=self.message_id)
                    if (t2_reasoning):
                        content = [{"type": "text", "text": t2_reasoning}]
                        model_params["messages"].append(AIMessage(content=content))
                elif (messages["type"] == "action.init"):
                    tool_call_request = {
                        "tool_calls": [{
                            "id": messages["id"],
                            "type": "function",
                            "function": {
                                "name": messages["name"],
                                "arguments": messages["arguments"]
                            }
                        }]
                    }
                    model_params["messages"].append(AIMessage(content="", additional_kwargs=tool_call_request))
                elif (messages["type"] == "action.result"):
                    model_params["messages"].append(ToolMessage(content=messages["output"], tool_call_id=messages["id"]))
                elif (messages["type"] == "screenshot" and mode == "t2"):
                    if ("parser" in messages and messages["parser"] == 1):
                        # Screenshot content
                        request_type = "screenshot"
                        parser_task = self.async_screenshot_parse(messages["image"])
                        parser_tasks.append(parser_task)
                        metadata[index] = messages["metadata"]
                    elif ("parser" in messages and messages["parser"] == 2):
                        # Scroll content
                        request_type = "scroll"
                        grider_task = self.async_grid_parse(messages["image"])
                        grider_tasks.append(grider_task)
                        metadata[index] = messages["metadata"]
                else:
                    model_params["messages"].append(messages)
        
        if (request_type == "screenshot"):
            # Inject annotated screenshot
            parser_content = await asyncio.gather(*parser_tasks, return_exceptions=True)
            for index, (image, props) in zip(metadata, parser_content):
                page_meta = metadata[index]
                client_props = {**await self.get_client_props(), "metadata": page_meta, "fetch_props": props}
                await self.redis.hset(self.key, "client_props", json.dumps(client_props))
                # Consider system prompt while inserting
                model_params["messages"].insert(index + 1, HumanMessage(content=[
                    {
                        "type": "text",
                        "text": f"<SYSTEM>This is the output of the `fetchScreen()` tool call. It contains the page metadata, and the annotated image. You can use this information to perform actions on the page.</SYSTEM><PAGE_METDATA><URL>{page_meta['url']}</URL><TITLE>{page_meta['title']}</TITLE><LOADING_STATUS>{page_meta['loading_status']}</LOADING_STATUS></PAGE_METDATA>"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image,
                            "detail": "high"
                        }
                    }
                ]))
        elif (request_type == "scroll"):
            # Inject annotated screenshot
            results = await asyncio.gather(*grider_tasks, return_exceptions=True)
            for index, (image, props) in zip(metadata, results):
                page_meta = metadata[index]
                client_props = {**await self.get_client_props(), "metadata": page_meta, "scroll_props": props}
                await self.redis.hset(self.key, "client_props", json.dumps(client_props))
                # Consider system prompt while inserting
                model_params["messages"].insert(index + 1, HumanMessage(content=[
                    {
                        "type": "text",
                        "text": f"<SYSTEM>This is the output of the `getScrollPortions()` tool call. It contains the annotated image of the current page with a grid overlay highlighting the scrollable portions with a unique ID. You can use this ID to scroll the desired portion.</SYSTEM>"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image
                        }
                    }
                ]))
        
        return model_params

    async def response_handler(self, chunk: BaseMessage, request_params):
        response_type = None
        # DB updates
        if (chunk.content):
            content = chunk.content
            if (self.client.metadata.mode == "t1"):
                self.response_store["text"]["response"] += content
            elif (self.client.metadata.mode == "t2"):
                self.response_store["t2_reasoning"] += content
            elif (self.client.metadata.mode == "t3"):
                self.response_store["text"]["validation"] += content
            elif (self.client.metadata.mode == "t4"):
                self.response_store["text"]["output"] += content
            
            self.text_response += content
            response_type = "text.stream"
            self.stream_text = content
            # await super().async_update_usage(chunk["response"]["usage"])
        
        if (chunk.tool_call_chunks):
            toolCalls = chunk.tool_call_chunks
            for toolCall in toolCalls:
                index = toolCall["index"]
                if (not index in self.tool_calls):
                    self.tool_calls[index] = {
                        "id": toolCall["id"],
                        "name": toolCall["name"],
                        "arguments": toolCall["args"]
                    }
                self.tool_calls[index]["arguments"] += toolCall["args"]
        
        if ("finish_reason" in chunk.response_metadata):
            finish_reason = chunk.response_metadata["finish_reason"]
            if (finish_reason == "tool_calls"):
                print("ToolCall:", self.tool_calls)
                if (self.client.metadata.mode == "t2"):
                    for idx in self.tool_calls:
                        self.t2_tool_calls.append({
                            "type": "action.init",
                            "id": self.tool_calls[idx]["id"],
                            "name": self.tool_calls[idx]["name"],
                            "arguments": self.tool_calls[idx]["arguments"]
                        })
                        if (self.tool_calls[idx]["arguments"]):
                            toolName = self.tool_calls[idx]["name"]
                            toolArgs = json.loads(self.tool_calls[idx]["arguments"])
                            if ("elementId" in toolArgs):
                                element_id = toolArgs["elementId"]
                                client_props = await self.get_client_props()
                                fetch_props = client_props["fetch_props"]
                                devicePixelRatio = client_props["metadata"]["pixelRatio"]
                                coords = await self.id_to_coords(element_id, fetch_props, devicePixelRatio)
                                if coords:
                                    toolArgs.pop("elementId")
                                    toolArgs["x"] = coords["x"]
                                    toolArgs["y"] = coords["y"]
                                    self.tool_calls[idx]["arguments"] = json.dumps(toolArgs)
                            elif ("portionId" in toolArgs):
                                portion_id = toolArgs["portionId"]
                                client_props = await self.get_client_props()
                                scroll_props = client_props["scroll_props"]
                                devicePixelRatio = client_props["metadata"]["pixelRatio"]
                                coords = await self.id_to_coords(portion_id, scroll_props, devicePixelRatio)
                                if coords:
                                    toolArgs.pop("portionId")
                                    toolArgs["x"] = coords["x"]
                                    toolArgs["y"] = coords["y"]
                                    self.tool_calls[idx]["arguments"] = json.dumps(toolArgs)
                    current_reasoning = self.response_store["t2_reasoning"]
                    if (current_reasoning):
                        previous_reasoning = await self.conv_db.get_t2_reasoning(message_id=self.message_id)
                        prompt_content = f"# PREVIOUS REASONING:\n {previous_reasoning}\n\n# CURRENT REASONING:\n {current_reasoning}\n\n# TOOL CALL:\n {self.tool_calls}"
                        # previous_steps = await self.conv_db.get_execution_steps(message_id=self.message_id)
                        try:
                            step_chunk = await litellm.acompletion(
                                model="groq/openai/gpt-oss-120b",
                                messages=[
                                    { "role": "system", "content": T5_PROMPT },
                                    { "role": "user", "content": prompt_content }
                                ]
                            )
                        except:
                            pass
                        # DB updates
                        self.response_store["text"]["execution"].append(step_chunk.choices[0].message.content)
                        print("GENERATED STEP:::", step_chunk.choices[0].message.content)
                        self.stream_text = step_chunk.choices[0].message.content
                response_type = "action.call"
            
            if (finish_reason == "stop"):
                pass
        
        # if (chunk.usage):
        #     chunk_dict["type"] = "response.completed"
    
        return response_type
    
    async def post_handler(self, response_type, request_params):
        post_params = {}
        if (response_type == "response.started"): # response.start
            post_params["type"] = "response.started"
            post_params["id"] = self.response_id
            post_params["message_id"] = self.message_id
            post_params["started_at"] = datetime.datetime.now(datetime.timezone.utc).timestamp()
        elif (response_type == "text.stream"): # text.stream
            if (self.client.metadata.mode != "t2"):
                post_params["type"] = "text.stream"
                post_params["id"] = self.response_id
                post_params["text"] = self.stream_text
        elif (response_type == "action.call"): # action.call
            post_params["type"] = "action.call"
            post_params["id"] = self.response_id
            post_params["action"] = self.tool_calls
            if (self.stream_text): post_params["step"] = self.stream_text
        elif (response_type == "response.completed"): # response.completed
            post_params["type"] = "response.completed"
            post_params["id"] = self.response_id
            post_params["message_id"] = self.message_id
            post_params["completed_at"] = datetime.datetime.now(datetime.timezone.utc).timestamp()
        
        # DB updates
        if (post_params):
            if (self.client.metadata.mode == "t1"):
                if (post_params["type"] == "action.call"):
                    for idx in post_params["action"]:
                        if (post_params["action"][idx]["name"] == "proceed"):
                            json_data = json.loads(post_params["action"][idx]["arguments"])
                            task = json_data["task"]
                            self.response_store["task"] = task
            elif (self.client.metadata.mode == "t3"):
                if (post_params["type"] == "action.call"):
                    for idx in post_params["action"]:
                        if (post_params["action"][idx]["name"] == "success"):
                            self.response_store["taskStatus"] = "success"
                        elif (post_params["action"][idx]["name"] == "failed"):
                            self.response_store["taskStatus"] = "failed"
                        elif (post_params["action"][idx]["name"] == "suspended"):
                            self.response_store["taskStatus"] = "suspended"
        
        return post_params