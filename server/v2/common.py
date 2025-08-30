import base64
import datetime
import json
import uuid
import time
from typing import cast

from fastapi import HTTPException
from type import State, BaseClient, BaseClientMetadata
import asyncio

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