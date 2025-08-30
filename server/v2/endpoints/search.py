import datetime
from fastapi import HTTPException
from typing import cast
from common import RequestHandler, ConversationDB
from type import SearchClient

import json
import litellm
from ai.instructions.search import SEARCH_PROMPT
from ai.tools.search import SEARCH_TOOLS

class SearchRequest(RequestHandler):
    def __init__(self, state, key, client, user_id, response_id):
        super().__init__(state, key, user_id, response_id)
        self.client = cast(SearchClient, client)
        self.conv_db = ConversationDB(
            state=self.state,
            user_id=self.user_id,
            conv_id=self.client.id,
            metadata=self.client.metadata
        )
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

        if (self.client.data[-1]["type"] == "prompt"):
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

        response = await litellm.aresponses(**request_params)
        async for chunk in response:
            if not isinstance(chunk, dict):
                try:
                    chunk = chunk.model_dump()
                except AttributeError:
                    print("Chunk is not a dict:", chunk)
                    continue
            
            response_params = await self.response_handler(chunk, request_params)
            if (response_params):
                post_params = await self.post_handler(response_params, request_params)
                if (post_params):
                        yield f"data: {json.dumps(post_params)}\n\n"
        
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
        previous_prompt, _ = await self.conv_db.get_previous_messages()
        self.client.data = previous_prompt + self.client.data
        model_params = {
            "model": "groq/llama-3.3-70b-versatile",
            "stream": True,
            "temperature": 0.5,
            "parallel_tool_calls": False,
            "tool_choice": "auto",
            "truncation": "auto",
            "instructions": SEARCH_PROMPT,
            "tools": SEARCH_TOOLS,
            "input": []
        }

        for index, messages in enumerate(self.client.data):
            messages = dict(messages)
            if ("type" in messages):
                if (messages["type"] == "prompt"):
                    content = []
                    for msg in messages["content"]:
                        if ("type" in msg and msg["type"] == "text"):
                            content.append({ "type": "input_text", "text": msg["text"] })
                        elif ("type" in msg and msg["type"] == "file"):
                            file = msg["payload"]
                            file_content = file["content"]
                            mime_type = file["mimeType"]
                            data_uri = f"data:{mime_type};base64,{file_content}"
                            if file["mimeType"].startswith("image"):
                                content.append({ "type": "input_image", "image_url": data_uri })
                            else:
                                content.append({ "type": "input_file", "filename": file["name"], "file_data": data_uri })
                    model_params["input"].append({ "role": "user", "content": content })
                elif (messages["type"] == "response"):
                    content = []
                    for msg in messages["content"]:
                        if ("type" in msg and msg["type"] == "text"):
                            content.append({ "type": "output_text", "text": msg["text"] })
                        elif ("type" in msg and msg["type"] == "file"):
                            file = msg["payload"]
                            file_content = file["content"]
                            mime_type = file["mimeType"]
                            data_uri = f"data:{mime_type};base64,{file_content}"
                            if file["mimeType"].startswith("image"):
                                content.append({ "type": "output_image", "image_url": data_uri })
                            else:
                                content.append({ "type": "output_file", "filename": file["name"], "file_data": data_uri })
                    model_params["input"].append({ "role": "assistant", "content": content })
        
        return model_params

    async def response_handler(self, chunk, request_params):
        if ("type" in chunk):
            # DB updates
            if (chunk["type"] == "response.completed" and chunk["response"]["output"][0]["type"] == "message"):
                self.response_store["text"]["response"] = chunk["response"]["output"][0]["content"][0]["text"]
                
                await super().async_update_usage(chunk["response"]["usage"])
        
        return chunk
    
    async def post_handler(self, response, request_params):
        post_params = {}
        if ("type" in response):
            if (response["type"] == "response.created"): # response.start
                post_params["type"] = "response.started"
                post_params["id"] = self.response_id
                post_params["message_id"] = self.message_id
                post_params["started_at"] = datetime.datetime.now(datetime.timezone.utc).timestamp()
            elif (response["type"] == "response.output_text.delta"): # text.stream
                post_params["type"] = "text.stream"
                post_params["id"] = self.response_id
                post_params["text"] = response["delta"]
            elif (response["type"] == "response.content_part.done"): # text.done
                post_params["type"] = "text.done"
                post_params["id"] = self.response_id
            elif (response["type"] == "error"): # response.error
                post_params["type"] = "response.error"
                post_params["id"] = self.response_id
                post_params["error"] = response["message"]
            elif (response["type"] == "response.completed"): # response.completed
                post_params["type"] = "response.completed"
                post_params["id"] = self.response_id
                post_params["message_id"] = self.message_id
                post_params["completed_at"] = datetime.datetime.now(datetime.timezone.utc).timestamp()
        
        return post_params