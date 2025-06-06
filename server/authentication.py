import os
import json
import time
from redis import Redis
from supabase import create_client, Client
from litellm.proxy.proxy_server import UserAPIKeyAuth

supabase_url: str = os.environ.get("SUPABASE_URL")
supabase_key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

redis = Redis(host="localhost", port=6379)

def sync_keymap(keymap, session, user_id):
    redis.hset(keymap, "session", session)
    redis.hset(keymap, "user_id", user_id)
    redis.expire(keymap, 604800)

def sync_account(key, user_id):
    db_data = supabase.from_("users").select("*", count="exact").eq("id", user_id).execute()
    if db_data.count > 0:
        data = db_data.data[0]
        redis_data = {
            "account_id":  data["account_id"],
            "name": data["name"],
            "email": data["email"],
            "phone_number": data["phone_number"],
            "image": data["image"]
        }
        redis.hset(key, "account", json.dumps(redis_data))
        return redis_data
    else:
        raise Exception("Invalid account.")

def sync_credits(key, user_id):
    db_data = supabase.from_("credits").select("*", count="exact").eq("user_id", user_id).execute()
    if db_data.count > 0:
        data = db_data.data[0]
        redis_data = {
            "active": True if data["linked_subscription"] else False,
            "total_credits": data["total_credits"],
            "used_credits": data["used_credits"],
            "total_tokens": data["total_tokens"],
            "used_tokens": data["used_tokens"],
            "last_sync": int(time.time() * 1000)
        }
        redis.hset(key, "credits", json.dumps(redis_data))
        return redis_data
    else:
        raise Exception("Credits not found.")

async def user_api_key_auth(request, api_key) -> UserAPIKeyAuth:
    try:
        metadata = json.loads(await request.body())["metadata"]
        client_id = metadata["client_id"]
        account_id = metadata["account_id"]
        if not api_key or not client_id or not account_id:
            raise Exception
    except:
        raise Exception("Invalid request.")

    key = "session:" + api_key
    try:
        redis_user_id = redis.hget(key, "user_id")
        print("REDIS:", redis_user_id, key)
        if not redis_user_id:
            raise Exception
        user_id = redis_user_id.decode("utf-8")
    except:
        raise Exception("Invalid session.")
    
    try:
        redis_account = redis.hget(key, "account")
        if not redis_account:
            raise Exception
        account = json.loads(redis_account)
    except:
        account = sync_account(key, user_id)
    
    if account["account_id"] != account_id:
        raise Exception("account_id mismatch")

    try:
        redis_credits = redis.hget(key, "credits")
        if not redis_credits:
            raise Exception
        credits = json.loads(redis_credits)
    except:
        credits = sync_credits(key, user_id)
        print("REDIS Sync 1")

    if not "last_sync" in credits:
        credits = sync_credits(key, user_id)
        print("REDIS Sync 2")
    if (int(time.time() * 1000) - int(credits["last_sync"])) > 60000:
        credits = sync_credits(key, user_id)
        print("REDIS Sync 3")

    if not credits["active"]:
        raise Exception("No active subscription.")
    
    if credits["used_tokens"] >= credits["total_tokens"]:
        raise Exception("No credits available.")
    
    keymap = "keymap:" + account_id + ":" + client_id
    if not redis.exists(keymap):
        sync_keymap(keymap, api_key, user_id)
    
    return UserAPIKeyAuth(api_key=api_key)