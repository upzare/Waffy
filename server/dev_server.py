import base64
import datetime
import json
import time
from typing import Annotated, Optional, cast
import uuid
from fastapi import Depends, FastAPI, Request, APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field
import uvicorn

import litellm
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage

from instructions import RESEARCH_PROMPT, T1_PROMPT, T2_PROMPT, T3_PROMPT, T4_PROMPT, T5_PROMPT, TITLE_PROMPT, SEARCH_PROMPT, SEARCH_TOOLS
from beta_tools import T1_TOOLS, T2_TOOLS, T3_TOOLS

import asyncio
from util.omniparser import Omniparser
from util.utils import detect_device
from util.grider import Grider

import os
from supabase import acreate_client, AsyncClient
from redis.asyncio import Redis

from dotenv import load_dotenv

load_dotenv()

DEBUG = True
# litellm._turn_on_debug() if DEBUG else None

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key: str = os.environ.get("SUPABASE_KEY")
config = {
    "som_model_path": "weights/icon_detect/model.pt",
    "caption_model_name": "florence2",
    "caption_model_path": "weights/icon_caption_florence",
    "device": detect_device(),
    "BOX_TRESHOLD": 0.25,
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
    message_id: Optional[str] = None

class AutomateClient(BaseModel):
    id: str
    data: list
    metadata: AutomateClientMetadata

class SearchClientMetadata(BaseModel):
    client_id: str
    account_id: str

class SearchClient(BaseModel):
    id: str
    data: list
    metadata: SearchClientMetadata

class ResearchClientMetadata(BaseModel):
    client_id: str
    account_id: str

class ResearchClient(BaseModel):
    id: str
    data: list
    metadata: ResearchClientMetadata

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
        self.bucket = "user-uploads"
        self.bucket_folder = "waffy-extension"
    
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
    
    async def upload_file(self, content, mime_type):
        file_id = f"{self.id}:{str(uuid.uuid4())}"
        file_path = f"{self.bucket_folder}/{file_id}"
        file_data = base64.b64decode(content)
        upload_task = self.supabase.storage.from_(self.bucket).upload(
            file=file_data,
            path=file_path,
            file_options={"cache-control": "3600", "upsert": "false", "content-type": mime_type}
        )
        asyncio.create_task(upload_task)
        return file_path
    
    async def download_file(self, file_path):
        file_data = await self.supabase.storage.from_(self.bucket).download(file_path)
        return base64.b64encode(file_data).decode("utf-8")
    
    async def get_previous_messages(self):
        previous_prompt = []
        previous_task = []
        user_files = []
        db_data = await self.supabase.from_("messages").select("*", count="exact").eq("conversation_id", self.id).order("created_at", desc=False).execute()
        if (db_data.data):
            for data in db_data.data:
                if (data["role"] == "user"):
                    # Download files from bucket
                    for file in data["content"]["files"]:
                        file["payload"]["content"] = await self.download_file(file["payload"]["content"])
                    previous_prompt.append({ "type": "prompt", "content": [{ "type": "text", "text": data["content"]["text"]["prompt"] }, *data["content"]["files"]] })
                    if user_files: user_files.append(*data["content"]["files"])
                elif (data["role"] == "assistant"):
                    # Download files from bucket
                    for file in data["content"]["files"]:
                        file["payload"]["content"] = await self.download_file(file["payload"]["content"])
                    if (len(data["content"]["text"]["output"])):
                        task_response = f'Validation status: {data["content"]["taskStatus"]}\n\nOutput: {data["content"]["text"]["output"]}'
                        previous_task.append({ "type": "prompt", "content": [{ "type": "text", "text": data["content"]["task"] }, *user_files] })
                        previous_task.append({ "type": "response", "content": [{ "type": "text", "text": task_response }, *data["content"]["files"]] })
                    assistant_response = data["content"]["text"]["output"] if len(data["content"]["text"]["output"]) else data["content"]["text"]["response"]
                    previous_prompt.append({ "type": "response", "content": [{ "type": "text", "text": assistant_response }, *data["content"]["files"]] })
                    user_files = []
        
        return previous_prompt, previous_task

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
    
    async def get_execution_steps(self, message_id):
        msg_id = f"{self.id}:{message_id}"
        db_data = await self.supabase.from_("messages").select("*", count="exact").eq("id", msg_id).execute()
        if (db_data.count < 1):
            return None
        db_content = db_data.data[0]["content"]
        return db_content["text"]["execution"]

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

    async def authenticate(self):
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

class ResearchRequest(RequestHandler):
    def __init__(self, state, key, client, user_id, response_id):
        super().__init__(state, key, user_id, response_id)
        self.client = cast(ResearchClient, client)
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
            "model": "groq/deepseek-r1-distill-llama-70b",
            "stream": True,
            "temperature": 0.5,
            "parallel_tool_calls": False,
            "truncation": "auto",
            "instructions": RESEARCH_PROMPT,
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
                "reasoning_effort": "low",
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

@model.post("/start")
async def start_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: StartClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
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
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        meta_request = MetaRequest(app_state, key, client, user_id, response_id)
        response = await meta_request.process()
        return JSONResponse(content=response, status_code=200)
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/search")
async def search_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: SearchClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        automate_request = SearchRequest(app_state, key, client, user_id, response_id)
        response = automate_request.process()
        return StreamingResponse(response, media_type="text/event-stream")
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/research")
async def think_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: ResearchClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        automate_request = ResearchRequest(app_state, key, client, user_id, response_id)
        response = automate_request.process()
        return StreamingResponse(response, media_type="text/event-stream")
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/automate")
async def automate_endpoint(key: Annotated[str, Depends(validate_token)], request: Request, client: AutomateClient):
    # try:
        app_state = cast(State, request.app.state)
        user_id = await Authentication(app_state, key, client).authenticate()
        response_id = generate_unique_id()
        automate_request = AutomateRequest(app_state, key, client, user_id, response_id)
        response = automate_request.process()
        return StreamingResponse(response, media_type="text/event-stream")
    # except:
    #     raise HTTPException(status_code=500, detail="Internal server error.")

@model.post("/cloud")
async def think_endpoint(request: AutomateClient):
    pass

app.include_router(model, prefix="/inference")

if __name__ == "__main__":
    uvicorn.run("dev_server:app", host="0.0.0.0", port=4000, reload=False)