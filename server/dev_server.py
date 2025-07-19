import datetime
import json
import time
from typing import Annotated, Optional, cast
import uuid
from fastapi import Depends, FastAPI, Request, APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from pydantic import BaseModel
import uvicorn

import litellm
from instructions import T1_PROMPT, T2_PROMPT, T3_PROMPT, T4_PROMPT, T5_PROMPT, T1_TOOLS, T2_TOOLS, T3_TOOLS, TITLE_PROMPT

import asyncio
from util.omniparser import Omniparser
from util.utils import detect_device
from util.grider import Grider

import os
from supabase import acreate_client, AsyncClient
from redis.asyncio import Redis

DEBUG = False
litellm._turn_on_debug() if DEBUG else None

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key: str = os.environ.get("SUPABASE_KEY")
config = {
    "som_model_path": "weights/icon_detect/model.pt",
    "caption_model_name": "florence2",
    "caption_model_path": "weights/icon_caption_florence",
    "device": detect_device(),
    "BOX_TRESHOLD": 0.05,
}

class State:
    supabase: Optional[AsyncClient]
    redis: Optional[Redis]
    omniparser: Optional[Omniparser]
    grider: Optional[Grider]

class BaseClientMetadata(BaseModel):
    client_id: str
    account_id: str

class BaseClient(BaseModel):
    metadata: BaseClientMetadata

class StartClientMetadata(BaseModel):
    client_id: str
    account_id: str

class StartClient(BaseModel):
    id: str
    metadata: StartClientMetadata

class MetaClientMetadata(BaseModel):
    client_id: str
    account_id: str

class MetaClient(BaseModel):
    id: str
    prompt: str
    metadata: MetaClientMetadata

class AutomateClientMetadata(BaseModel):
    client_id: str
    account_id: str
    mode: str
    message_id: Optional[str]

class AutomateClient(BaseModel):
    id: str
    data: list
    metadata: AutomateClientMetadata

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.supabase = await acreate_client(supabase_url, supabase_key)
    app.state.redis = Redis(host="localhost", port=6379)
    app.state.omniparser = Omniparser(config)
    app.state.grider = Grider()
    print("Lifespan set", app.state.redis, app.state.supabase)
    yield
    # app.state.redis.close()

app = FastAPI(lifespan=lifespan)
model = APIRouter(lifespan=lifespan)
bearer_scheme = HTTPBearer()

async def validate_token(auth: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)], request: Request):
    app_state = cast(State, request.app.state)
    token = auth.credentials
    # key = "client:" + token
    key = "session:" + token
    if (not await app_state.redis.exists(key)):
        raise HTTPException(status_code=401, detail="Invalid token.")
    return key

def generate_unique_id(prefix="waffy"):
    unique_id = uuid.uuid4().hex
    return f"{prefix}_{unique_id}"

class ConversationDB:
    def __init__(self, state, user_id, conv_id, metadata):
        self.state = cast(State, state)
        self.id = f"{user_id}:{conv_id}"
        self.user_id = user_id
        self.conv_id = conv_id
        self.metadata = cast(BaseClientMetadata, metadata)
        self.supabase = self.state.supabase
    
    async def start_conversation(self):
        db_result = await self.supabase.from_("conversations").insert({
            "id": self.id,
            "user_id": self.user_id
        }).execute()
        if (db_result.data):
            return self.conv_id
        else:
            return None

    async def update_metadata(self, title):
        db_result = await self.supabase.from_("conversations").update({
            "metadata": {
                **self.metadata.model_dump(),
                "title": title
            },
        }).eq("id", self.id).execute()
        if (db_result.data):
            return self.conv_id
        else:
            return None

    async def create_message(self, role, content):
        message_id = str(uuid.uuid4())
        result = await self.supabase.from_("messages").insert({
            "id": f"{self.id}:{message_id}",
            "conversation_id": self.id,
            "role": role,
            "content": content,
            "metadata": self.metadata.model_dump()
        }).execute()
        if (result.data):
            return message_id
        else:
            return None
    
    async def update_message(self, message_id, content):
        msg_id = f"{self.id}:{message_id}"
        db_data = await self.supabase.from_("messages").select("content", count="exact").eq("id", msg_id).execute()
        if (db_data.count < 1):
            return None
        db_content = db_data.data[0]["content"]
        if (content["text"]["execution"] and len(db_content["text"]["execution"]) == 0):
            db_content["text"]["execution"] += ["Initializing"]
        db_content["task"] += content["task"]
        db_content["taskStatus"] += content["taskStatus"]
        db_content["text"]["response"] += content["text"]["response"]
        db_content["text"]["execution"] += content["text"]["execution"]
        db_content["text"]["validation"] += content["text"]["validation"]
        db_content["text"]["output"] += content["text"]["output"]
        db_content["files"] += content["files"]
        db_content["t2_reasoning"] += content["t2_reasoning"]
        result = await self.supabase.from_("messages").update({
            "content": db_content
        }).eq("id", msg_id).execute()
        if (result.data):
            return message_id
        else:
            return None
    
    async def get_task(self, message_id):
        msg_id = f"{self.id}:{message_id}"
        db_data = await self.supabase.from_("messages").select("*", count="exact").eq("id", msg_id).execute()
        if (db_data.count < 1):
            return None
        db_content = db_data.data[0]["content"]
        return db_content["task"]

    async def get_t2_reasoning(self, message_id):
        msg_id = f"{self.id}:{message_id}"
        db_data = await self.supabase.from_("messages").select("*", count="exact").eq("id", msg_id).execute()
        if (db_data.count < 1):
            return None
        db_content = db_data.data[0]["content"]
        return db_content["t2_reasoning"]

class Authentication:
    def __init__(self, state, key, client):
        self.state = cast(State, state)
        self.key = key
        self.client = cast(BaseClient, client)
        self.client
        self.redis = self.state.redis
        self.supabase = self.state.supabase
    
    async def sync_account(self, user_id):
        db_data = await self.supabase.from_("users").select("*", count="exact").eq("id", user_id).execute()
        if (db_data.count > 0):
            data = db_data.data[0]
            redis_data = {
                "account_id":  data["account_id"],
                "name": data["name"],
                "email": data["email"],
                "phone_number": data["phone_number"],
                "image": data["image"]
            }
            await self.redis.hset(self.key, "account", json.dumps(redis_data))
            return redis_data
        else:
            raise HTTPException(status_code=401, detail="Invalid account.")

    async def sync_credits(self, user_id):
        db_data = await self.supabase.from_("credits").select("*", count="exact").eq("user_id", user_id).execute()
        if (db_data.count > 0):
            data = db_data.data[0]
            redis_data = {
                "active": True if data["linked_subscription"] else False,
                "total_credits": data["total_credits"],
                "used_credits": data["used_credits"],
                "total_tokens": data["total_tokens"],
                "used_tokens": data["used_tokens"],
                "last_sync": int(time.time() * 1000)
            }
            await self.redis.hset(self.key, "credits", json.dumps(redis_data))
            return redis_data
        else:
            raise HTTPException(status_code=401, detail="Credits not found.")

    async def authentication(self):
        metadata = self.client.metadata
        
        client_id = metadata.client_id
        account_id = metadata.account_id
        
        redis_user_id = await self.redis.hget(self.key, "user_id")
        if (redis_user_id):
            user_id = redis_user_id.decode("utf-8")
        else:
            raise HTTPException(status_code=401, detail="Invalid session.")
        
        redis_account = await self.redis.hget(self.key, "account")
        if (redis_account):
            account = json.loads(redis_account)
        else:
            account = await self.sync_account(user_id)
        
        if (account["account_id"] != account_id):
            raise HTTPException(status_code=401, detail="ID mismatch.")
        
        redis_credits = await self.redis.hget(self.key, "credits")
        if (redis_credits):
            credits = json.loads(redis_credits)
        else:
            credits = await self.sync_credits(user_id)
            print("REDIS Sync 1")

        if (not "last_sync" in credits):
            credits = await self.sync_credits(user_id)
            print("REDIS Sync 2")

        if (int(time.time() * 1000) - int(credits["last_sync"])) > 60000:
            credits = await self.sync_credits(user_id)
            print("REDIS Sync 3")

        if (not credits["active"]):
            raise HTTPException(status_code=401, detail="No active subscription.")

        if (credits["used_tokens"] >= credits["total_tokens"]):
            raise HTTPException(status_code=401, detail="No credits available.")
        
        return user_id

class RequestHandler:
    def __init__(self, state, key, user_id, response_id):
        self.state = cast(State, state)
        self.redis = self.state.redis
        self.supabase = self.state.supabase
        self.key = key
        self.user_id = user_id
        self.response_id = response_id
    
    async def async_update_usage(self, usage):
        if not isinstance(usage, dict):
            try:
                usage = usage.model_dump()
            except AttributeError:
                print("chunk is not a dict:", usage)
        # DB Update
        db_request = await self.supabase.from_("credits").select("*", count="exact").eq("user_id", self.user_id).execute()
        if (db_request.count < 1):
            raise HTTPException(status_code=401, detail="Invalid user.")
        db_data = db_request.data[0]
        used_tokens = db_data["used_tokens"]
        new_used_tokens = int(used_tokens + usage["total_tokens"])
        used_credits = db_data["used_credits"]
        new_used_credits = int(used_credits + (usage["total_tokens"] / 100))
        current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
        db_update = self.supabase.from_("credits").update({"used_tokens": new_used_tokens, "used_credits": new_used_credits, "updated_at": current_time}).eq("user_id", self.user_id).execute()
        # Redis Update
        redis_data = {
            "active": True if db_data["linked_subscription"] else False,
            "total_credits": db_data["total_credits"],
            "used_credits": new_used_tokens,
            "total_tokens": db_data["total_tokens"],
            "used_tokens": new_used_credits,
            "last_sync": 0 # Sync redis on next user request
        }
        redis_update_1 = self.redis.hset(self.key, "credits", json.dumps(redis_data))
        redis_update_2 = self.redis.expire(self.key, 604800)
        await asyncio.gather(db_update, redis_update_1, redis_update_2)
        print("UPDATED CREDITS:", new_used_credits)

class StartRequest(RequestHandler):
    def __init__(self, state, key, client, user_id, response_id):
        super().__init__(state, key, user_id, response_id)
        self.client = cast(StartClient, client)
        self.conv_db = ConversationDB(
            state=self.state,
            user_id=self.user_id,
            conv_id=self.client.id,
            metadata=self.client.metadata
        )
    
    async def start(self):
        result = await self.conv_db.start_conversation()
        if (not result):
            raise HTTPException(status_code=500, detail="Failed to start conversation.")
        return {
            "status": "success",
            "type": "conversation.initiated",
            "id": self.response_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp(),
            "metadata": self.client.metadata.model_dump()
        }

class MetaRequest(RequestHandler):
    def __init__(self, state, key, client, user_id, response_id):
        super().__init__(state, key, user_id, response_id)
        self.client = cast(MetaClient, client)
        self.conv_db = ConversationDB(
            state=self.state,
            user_id=self.user_id,
            conv_id=self.client.id,
            metadata=self.client.metadata
        )
    
    async def process(self):
        request_params = await self.request_handler()
        response = await litellm.aresponses(**request_params)
        if not isinstance(response, dict):
            try:
                response = response.model_dump()
            except AttributeError:
                print("response is not a dict:", response)
        
        response_params = await self.response_handler(response, request_params)
        if (response_params):
            post_params = await self.post_handler(response_params, request_params)
            if (post_params):
                result = await self.conv_db.update_metadata(post_params["title"])
                if (not result):
                    raise HTTPException(status_code=500, detail="Failed to update metadata.")
                return post_params

    async def request_handler(self):
        model_params = {
            # "model": "gpt-4.1-nano",
            "model": "groq/llama-3.3-70b-versatile",
            "stream": False,
            "input": [{'role': 'system', 'content': TITLE_PROMPT}, { "role": "user", "content": self.client.prompt }],
        }

        return model_params
    
    async def response_handler(self, chunk, request_params):
        # TODO: Update usage
        return chunk
    
    async def post_handler(self, response, request_params):
        post_params = {
            "status": "success",
            "type": "conversation.created",
            "id": self.response_id,
            "title": response["output"][0]["content"][0]["text"],
            "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp(),
            "metadata": self.client.metadata.model_dump()
        }
        return post_params

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
        self.omniparser = self.state.omniparser
        self.grider = self.state.grider
        self.message_id = self.client.metadata.message_id

    async def get_client_props(self):
        redis_client_props = await self.redis.hget(self.key, "client_props")
        if redis_client_props is not None:
            if isinstance(redis_client_props, bytes):
                redis_client_props = redis_client_props.decode("utf-8")
            base_props = json.loads(redis_client_props)
        else:
            base_props = {}
        return base_props

    async def async_screenshot_parse(self, image):
        def parse():
            print("F1 started:", time.perf_counter())
            dino_labled_img, label_coordinates, parsed_content_list = self.omniparser.parse(image)
            item_props = []
            for i, (k, props) in enumerate(label_coordinates.items()):
                item_props.append({
                    "id": int(k),
                    "x": float(props[0]),
                    "y": float(props[1]),
                    "width": float(props[2]),
                    "height": float(props[3]),
                    "type": parsed_content_list[i]["type"],
                    "content": parsed_content_list[i]["content"],
                    "interactivity": parsed_content_list[i]["interactivity"]
                })
            annotated_image = f"data:image/png;base64,{dino_labled_img}"
            print("F1 ended:", time.perf_counter())
            return annotated_image, item_props
        
        return await asyncio.to_thread(parse)

    async def async_grid_parse(self, image):
        def parse():
            print("P1 started:", time.perf_counter())
            annotated_base64, grid_props = self.grider.parse(image)
            annotated_image = f"data:image/png;base64,{annotated_base64}"
            print("P1 ended:", time.perf_counter())
            return annotated_image, grid_props
        
        return await asyncio.to_thread(parse)
    
    async def id_to_coords(self, id, props, devicePixelRatio):
        # target = list(filter(lambda e: e["id"] == id, props))[0] if props else None
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
        if (self.client.metadata.mode == "t1" and self.client.data[-1]["type"] == "prompt"):
            # DB: Create user message
            content = self.client.data[-1]["content"]
            self.request_store = {
                "text": {},
                "files": []
            }
            for data in content:
                if ("type" in data and data["type"] == "text"):
                    self.request_store["text"] = {**self.request_store["text"], "prompt": data["text"]}
                elif ("type" in data and data["type"] == "file"):
                    self.request_store["files"].append(data["payload"])

            await self.conv_db.create_message(
                role="user",
                content=self.request_store
            )
        
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
        
        if (not self.message_id):
            # DB: Create assistant message
            create_result = await self.conv_db.create_message(
                role="assistant",
                content=self.response_store,
            )
            if (create_result):
                self.message_id = create_result
            else:
                self.raise_sse_error("Failed to create message.")
                return
            print("MESSAGE ID:", self.message_id)
        
        request_params = await self.request_handler()
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
            self.raise_sse_error("Failed to update message.")
            return
        yield "data: [DONE]"

    async def request_handler(self):
        mode = self.client.metadata.mode
        
        if (mode == "t1"):
            model_params = {
                "model": "openai/gpt-4.1",
                # "model": "groq/llama-3.3-70b-versatile",
                "tools": T1_TOOLS,
                "stream": True,
                "temperature": 0.5,
                "parallel_tool_calls": False,
                "tool_choice": "auto",
                "truncation": "auto",
                "input": [{'role': 'system', 'content': T1_PROMPT}],
            }
        elif (mode == "t2"):
            model_params = {
                    "model": "openai/gpt-4.1",
                    "tools": T2_TOOLS,
                    "stream": True,
                    "temperature": 0,
                    "parallel_tool_calls": False,
                    "tool_choice": "auto",
                    "truncation": "auto",
                    "input": [{'role': 'system', 'content': T2_PROMPT}],
            }
        elif (mode == "t3"):
            model_params = {
                    "model": "openai/gpt-4.1",
                    "tools": T3_TOOLS,
                    "stream": True,
                    "temperature": 0.1,
                    "parallel_tool_calls": False,
                    "tool_choice": "auto",
                    "truncation": "auto",
                    "input": [{'role': 'system', 'content': T3_PROMPT}],
            }
        elif (mode == "t4"):
            model_params = {
                    "model": "openai/gpt-4.1-nano",
                    "stream": True,
                    "temperature": 1,
                    "parallel_tool_calls": False,
                    "tool_choice": "auto",
                    "truncation": "auto",
                    "input": [{'role': 'system', 'content': T4_PROMPT}],
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
                    model_params["input"].append(messages)
        
        if (request_type == "screenshot"):
            # Inject annotated screenshot
            parser_content = await asyncio.gather(*parser_tasks, return_exceptions=True)
            for index, (image, props) in zip(metadata, parser_content):
                page_meta = metadata[index]
                client_props = {**await self.get_client_props(), "metadata": page_meta, "fetch_props": props}
                await self.redis.hset(self.key, "client_props", json.dumps(client_props))
                # Consider system prompt while inserting
                model_params["input"].insert(index + 1, {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": f"<SYSTEM>This is the output of the `fetchScreen()` tool call. It contains the page metadata, and the annotated image. You can use this information to perform actions on the page.</SYSTEM><PAGE_METDATA><URL>{page_meta['url']}</URL><TITLE>{page_meta['title']}</TITLE><LOADING_STATUS>{page_meta['loading_status']}</LOADING_STATUS></PAGE_METDATA>"
                        },
                        {
                            "type": "input_image",
                            "image_url": image
                        }
                    ]
                })
        elif (request_type == "scroll"):
            # Inject annotated screenshot
            results = await asyncio.gather(*grider_tasks, return_exceptions=True)
            for index, (image, props) in zip(metadata, results):
                page_meta = metadata[index]
                client_props = {**await self.get_client_props(), "metadata": page_meta, "fetch_props": props}
                await self.redis.hset(self.key, "client_props", json.dumps(client_props))
                # Consider system prompt while inserting
                model_params["input"].insert(index + 1, {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": f"<SYSTEM>This is the output of the `getScrollPortions()` tool call. It contains the annotated image of the current page with a grid overlay highlighting the scrollable portions with a unique ID. You can use this ID to scroll the desired portion.</SYSTEM>"
                        },
                        {
                            "type": "input_image",
                            "image_url": image
                        }
                    ]
                })

        if (mode == "t3" or mode == "t4"):
            t2_reasoning_job = self.conv_db.get_t2_reasoning(message_id=self.message_id)
            get_task_job = self.conv_db.get_task(message_id=self.message_id)
            [t2_reasoning, task] = await asyncio.gather(t2_reasoning_job, get_task_job)
            if (t2_reasoning and task):
                prompt = f"**Task:**\n{task}\n\n**Output:**\n{t2_reasoning}"
                model_params["input"].append({ "role": "user", "content": [{ "type": "input_text", "text": prompt }] })
        
        return model_params

    async def response_handler(self, chunk, request_params):
        if ("type" in chunk):
            # DB updates
            if (chunk["type"] == "response.completed" and chunk["response"]["output"][0]["type"] == "message"):
                if (self.client.metadata.mode == "t1"):
                    self.response_store["text"]["response"] = chunk["response"]["output"][0]["content"][0]["text"]
                elif (self.client.metadata.mode == "t2"):
                    self.response_store["t2_reasoning"] = chunk["response"]["output"][0]["content"][0]["text"]
                elif (self.client.metadata.mode == "t3"):
                    self.response_store["text"]["validation"] = chunk["response"]["output"][0]["content"][0]["text"]
                elif (self.client.metadata.mode == "t4"):
                    self.response_store["text"]["output"] = chunk["response"]["output"][0]["content"][0]["text"]
                
                await super().async_update_usage(chunk["response"]["usage"])
            
            if (chunk["type"] == "response.output_item.done" and "item" in chunk and "type" in chunk["item"] and chunk["item"]["type"] == "function_call"):
                toolName = chunk["item"]["name"]
                toolArgs = json.loads(chunk["item"]["arguments"])
                if ("elementId" in toolArgs):
                    element_id = toolArgs["elementId"]
                    client_props = await self.get_client_props()
                    fetch_props = client_props["fetch_props"]
                    devicePixelRatio = client_props["metadata"]["pixelRatio"]
                    coords = await self.id_to_coords(element_id, fetch_props, devicePixelRatio)
                    if coords:
                        toolArgs.pop("elementId")
                        chunk["item"]["arguments"] = json.dumps({
                            "x": coords["x"],
                            "y": coords["y"],
                            **toolArgs
                        })
                        return chunk
                elif ("portionId" in toolArgs):
                    portion_id = toolArgs["portionId"]
                    client_props = await self.get_client_props()
                    scroll_props = client_props["scroll_props"]
                    devicePixelRatio = client_props["metadata"]["pixelRatio"]
                    coords = await self.id_to_coords(portion_id, scroll_props, devicePixelRatio)
                    if coords:
                        toolArgs.pop("portionId")
                        chunk["item"]["arguments"] = json.dumps({
                            "x": coords["x"],
                            "y": coords["y"],
                            **toolArgs
                        })
                        return chunk
            elif (chunk["type"] == "response.completed" and self.client.metadata.mode == "t2"):
                print("Executing step generator:::", chunk["response"]["output"])
                if (chunk["response"]["output"][0]["type"] == "message"):
                    t2_response = chunk["response"]["output"][0]["content"][0]["text"]
                    step_chunk = await litellm.aresponses(
                        model="groq/llama-3.3-70b-versatile",
                        instructions=T5_PROMPT,
                        temperature=1,
                        input=t2_response
                    )
                    step_chunk = step_chunk.model_dump()
                    # DB updates
                    self.response_store["text"]["execution"].append(step_chunk["output"][0]["content"][0]["text"])
                    print("GENERATED STEP:::", step_chunk["output"][0]["content"][0]["text"])
                    step_chunk["type"] = "step.generation"
                    await super().async_update_usage(step_chunk["usage"])
                    return step_chunk
        
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
                if (self.client.metadata.mode != "t2"):
                    post_params["type"] = "text.stream"
                    post_params["id"] = self.response_id
                    post_params["text"] = response["delta"]
            elif (response["type"] == "response.content_part.done"): # text.done
                post_params["type"] = "text.done"
                post_params["id"] = self.response_id
            elif (response["type"] == "response.output_item.done" and
                  response["item"] and response["item"]["type"] and
                  response["item"]["type"] == "function_call"
                ): # action.call
                post_params["type"] = "action.call"
                post_params["id"] = self.response_id
                post_params["action"] = response["item"]
            elif (response["type"] == "error"): # response.error
                post_params["type"] = "response.error"
                post_params["id"] = self.response_id
                post_params["error"] = response["message"]
            elif (response["type"] == "step.generation"): # response.completed (step generation)
                post_params["type"] = "response.completed"
                post_params["id"] = self.response_id
                post_params["message_id"] = self.message_id
                post_params["completed_at"] = datetime.datetime.now(datetime.timezone.utc).timestamp()
                post_params["step"] = response["output"][0]["content"][0]["text"]
            elif (response["type"] == "response.completed"): # response.completed
                post_params["type"] = "response.completed"
                post_params["id"] = self.response_id
                post_params["message_id"] = self.message_id
                post_params["completed_at"] = datetime.datetime.now(datetime.timezone.utc).timestamp()
            
            # DB updates
            if (post_params):
                if (self.client.metadata.mode == "t1"):
                    if (post_params["type"] == "action.call"):
                        if (post_params["action"]["name"] == "proceed"):
                            json_data = json.loads(post_params["action"]["arguments"])
                            task = json_data["task"]
                            self.response_store["task"] = task
                elif (self.client.metadata.mode == "t3"):
                    if (post_params["type"] == "action.call"):
                        if (post_params["action"]["name"] == "success"):
                            self.response_store["taskStatus"] = "success"
                        elif (post_params["action"]["name"] == "failed"):
                            self.response_store["taskStatus"] = "failed"
                        elif (post_params["action"]["name"] == "suspended"):
                            self.response_store["taskStatus"] = "suspended"
        
        return post_params

# class AutomateClientResponseOutputFunctionCall(BaseModel):
#     id: str
#     type: str
#     name: str
#     arguments: str
#     call_id: str
#     status: str

# class AutomateClientResponseOutputText(BaseModel):
#     id: str
#     type: str
#     text: str

# class AutomateClientResponseOutput(BaseModel):
#     id: str
#     type: str
#     item: AutomateClientResponseOutputFunctionCall | AutomateClientResponseOutputText

# class AutomateClientResponse(BaseModel):
#     type: str # "response.start" or "text.stream" or "text.done" or "action.call" or "response.error" or "response.completed"
#     data: list[AutomateClientResponseOutput]

@model.post("/start")
async def start_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: StartClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authentication()
        response_id = generate_unique_id()
        start_request = StartRequest(app_state, key, client, user_id, response_id)
        response = await start_request.start()
        return JSONResponse(content=response, status_code=200)
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/meta")
async def meta_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: MetaClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authentication()
        response_id = generate_unique_id()
        meta_request = MetaRequest(app_state, key, client, user_id, response_id)
        response = await meta_request.process()
        return JSONResponse(content=response, status_code=200)
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/search")
async def search_endpoint(request: AutomateClient):
    pass

@model.post("/think")
async def think_endpoint(request: AutomateClient):
    pass

@model.post("/automate")
async def automate_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: AutomateClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authentication()
        response_id = generate_unique_id()
        automate_request = AutomateRequest(app_state, key, client, user_id, response_id)
        response = automate_request.process()
        return StreamingResponse(response, media_type="text/event-stream")
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

app.include_router(model, prefix="/inference")

if __name__ == "__main__":
    uvicorn.run("dev_server:app", host="0.0.0.0", port=4000, reload=False)