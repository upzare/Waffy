import datetime
import json
import os
import asyncio
import time
from litellm._logging import verbose_proxy_logger
from litellm.integrations.custom_logger import CustomLogger
from litellm.proxy.proxy_server import UserAPIKeyAuth, DualCache
from typing import Optional, Literal
from util.omniparser import Omniparser
from util.utils import detect_device
import cloudinary
import cloudinary.uploader
from mistralai import Mistral
from instructions import T1_PROMPT, T2_PROMPT, T3_PROMPT, T4_PROMPT, T1_TOOLS, T2_TOOLS, T3_TOOLS, TITLE_PROMPT
from redis import Redis
from supabase import create_client, Client

DEBUG = True

config = {
    "som_model_path": "weights/icon_detect/model.pt",
    "caption_model_name": "florence2",
    "caption_model_path": "weights/icon_caption_florence",
    "device": detect_device(),
    "BOX_TRESHOLD": 0.05,
}

cloudinary.config( 
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key = os.environ.get("CLOUDINARY_API_KEY"),
    api_secret = os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

omniparser = Omniparser(config)

supabase_url: str = os.environ.get("SUPABASE_URL")
supabase_key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

redis = Redis(host="localhost", port=6379)

class CustomHandler(CustomLogger):
    def __init__(self):
        self.client_props = {}
        self.client_fc = {}

    # Handle User -> LLM
    async def async_pre_call_hook(self, user_api_key_dict: UserAPIKeyAuth, cache: DualCache, data: dict, call_type: Literal[
            "completion",
            "text_completion",
            "embeddings",
            "image_generation",
            "moderation",
            "audio_transcription",
        ]):
        try:
            if ("handler" in data):
                if (data["handler"] == "t1"):
                    data["model"] = "gpt-4.1"
                    data["tools"] = T1_TOOLS
                    data["stream"] = True
                    data["temperature"] = 0.5
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T1_PROMPT}]

                elif (data["handler"] == "t2"):
                    data["model"] = "gpt-4.1-mini"
                    data["tools"] = T2_TOOLS
                    data["stream"] = True
                    data["temperature"] = 0.1
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T2_PROMPT}]

                elif (data["handler"] == "t3"):
                    # data["model"] = "gpt-4.1"
                    data["model"] = "gpt-4.1-mini"
                    data["tools"] = T3_TOOLS
                    data["stream"] = True
                    data["temperature"] = 0
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T3_PROMPT}]

                elif (data["handler"] == "t4"):
                    data["model"] = "gpt-4.1-nano"
                    data["stream"] = True
                    data["temperature"] = 1
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T4_PROMPT}]

                screenshot_req = False
                parser_tasks = []
                ocr_tasks = []
                metadata = {}

                for index, messages in enumerate(data["data"]):
                    messages = dict(messages)
                    if ("type" in messages and messages["type"] == "prompt"):
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
                        data["input"].append({ "role": "user", "content": content })
                    elif ("type" in messages and messages["type"] == "response"):
                        content = []
                        for msg in messages["content"]:
                            if ("type" in msg and msg["type"] == "text"):
                                content.append({ "type": "output_text", "text": msg["text"] })
                            elif ("type" in msg and msg["type"] == "file"):
                                payload = msg["payload"]
                                if payload["mimeType"].startswith("image"):
                                    content.append({ "type": "output_image", "image_url": payload["url"] })
                                else:
                                    content.append({ "type": "output_file", "data": payload["url"], "mimeType": payload["mimeType"] })
                        data["input"].append({ "role": "assistant", "content": content })
                    elif ("type" in messages and messages["type"] == "screenshot" and data["handler"] == "t3"):
                        # Screenshot content
                        screenshot_req = True
                        parser_task = self.async_parse(messages["image"])
                        ocr_task = self.async_ocr(messages["image"])
                        parser_tasks.append(parser_task)
                        ocr_tasks.append(ocr_task)
                        metadata[index] = messages["metadata"]
                    else:
                        data["input"].append(messages)

                if (screenshot_req):
                    # Inject annotated screenshot + ocr
                    start_time = time.perf_counter()
                    print("Main Start:", start_time)
                    results = await asyncio.gather(*parser_tasks, *ocr_tasks, return_exceptions=True)
                    print("Main End:", time.perf_counter())
                    print("Total Time:", time.perf_counter() - start_time)
                    parser_content = results[:len(parser_tasks)]
                    ocr_content = results[len(parser_tasks):]
                    for index, (image, props), ocr in zip(metadata, parser_content, ocr_content):
                        meta = metadata[index]
                        asyncio.gather(self.async_upload(image)) if DEBUG else None
                        self.client_props[data["metadata"]["client_id"]] = { "meta": messages["metadata"], "props": props }
                        # Consider system prompt while inserting
                        data["input"].insert(index + 1, {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": f"<PAGE_METDATA><URL>{meta['url']}</URL><TITLE>{meta['title']}</TITLE><LOADING_STATUS>{meta['loading_status']}</LOADING_STATUS></PAGE_METDATA><PAGE_OCR_CONTENT>{ocr}</PAGE_OCR_CONTENT>"
                                },
                                {
                                    "type": "input_image",
                                    "image_url": image
                                }
                            ]
                        })
                
                del data["data"]
                
            if ("title" in data):
                data["model"] = "gpt-4.1-nano"
                data["stream"] = False
                data["input"] = [{'role': 'system', 'content': TITLE_PROMPT}, { "role": "user", "content": data["title"] }]
                del data["title"]
        
        except Exception as e:
            print("PRE-ERROR:", e)
        
        return data
    
    # Handle LLM -> User
    async def async_post_call_streaming_iterator_hook(self, user_api_key_dict, response, request_data):
        async for data in response:
            try:
                data_dict = dict(data)
                if ("type" in data_dict and "item" in data_dict and data_dict["type"] == "response.output_item.done"):
                    item = dict(data_dict["item"])
                    if ("type" in item and item["type"] == "function_call"):
                        toolName = item["name"]
                        toolArgs = json.loads(item["arguments"])
                        if ("elementId" in toolArgs):
                            element_id = toolArgs["elementId"]
                            props = self.client_props[request_data["metadata"]["client_id"]]["props"]
                            print("CONVERTING ID:", element_id) if DEBUG else None
                            target = list(filter(lambda e: e["id"] == str(element_id), props))[0] if props else None
                            devicePixelRatio = self.client_props[request_data["metadata"]["client_id"]]["meta"]["pixelRatio"]
                            if target:
                                x = target["x"]
                                y = target["y"]
                                click_cords_x = (x + target["width"] / 2) / devicePixelRatio
                                click_cords_y = (y + target["height"] / 2) / devicePixelRatio
                                toolArgs.pop("elementId")
                                item["arguments"] = json.dumps({
                                    "x": click_cords_x,
                                    "y": click_cords_y,
                                    **toolArgs
                                })
                                self.client_fc[item["id"]] = item
                                data_dict["item"] = item
                                yield type(data)(**data_dict)
                                continue
                elif ("type" in data_dict and data_dict["type"] == "response.function_call_arguments.delta" or data_dict["type"] == "response.function_call_arguments.done"):
                    continue
                elif ("type" in data_dict and data_dict["type"] == "response.completed"):
                    output = data_dict["response"]["output"]
                    for index, item in enumerate(output):
                        item_dict = dict(item)
                        if ("type" in item_dict and item_dict["type"] == "function_call"):
                            fc_id = item_dict["id"]
                            if (fc_id in self.client_fc):
                                data_dict["response"]["output"][index] = self.client_fc[fc_id]
                    usage = data_dict["response"]["usage"]
                    metadata = data_dict["response"]["metadata"]
                    asyncio.gather(self.async_update_usage(metadata, usage))
                    yield type(data)(**data_dict)
                    continue
            except Exception as e:
                print("POST-ERROR:", e)
            
            yield data
    
    async def async_update_usage(self, metadata, usage):
        def update_usage():
            keymap = "keymap:" + metadata["account_id"] + ":" + metadata["client_id"]
            session = redis.hget(keymap, "session").decode("utf-8")
            user_id = redis.hget(keymap, "user_id").decode("utf-8")
            # DB Update
            db_data = supabase.from_("credits").select("*", count="exact").eq("user_id", user_id).execute().data[0]
            used_tokens = db_data["used_tokens"]
            new_used_tokens = int(used_tokens + usage.total_tokens)
            used_credits = db_data["used_credits"]
            new_used_credits = int(used_credits + (usage.total_tokens / 100))
            current_time = datetime.datetime.now(datetime.timezone.utc).isoformat()
            supabase.from_("credits").update({"used_tokens": new_used_tokens, "used_credits": new_used_credits, "updated_at": current_time}).eq("user_id", user_id).execute()
            # Redis Update
            key = "session:" + session
            redis_data = {
                "active": True if db_data["linked_subscription"] else False,
                "total_credits": db_data["total_credits"],
                "used_credits": new_used_tokens,
                "total_tokens": db_data["total_tokens"],
                "used_tokens": new_used_credits,
                "last_sync": 0 # Sync redis on next prompt
            }
            redis.hset(key, "credits", json.dumps(redis_data))
            redis.expire(key, 604800)
        
        return await asyncio.to_thread(update_usage)
    
    async def async_parse(self, image):
        def parse():
            print("F1 started:", time.perf_counter())
            dino_labled_img, label_coordinates, parsed_content_list = omniparser.parse(image)
            item_props = []
            for i, (k, props) in enumerate(label_coordinates.items()):
                item_props.append({
                    "id": k,
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

    async def async_ocr(self, image):
        image_uri = f"data:image/png;base64,{image}"
        def get_ocr():
            print("F2 started:", time.perf_counter())
            mistral = Mistral(api_key=os.environ.get("MISTRAL_API_KEY"))
            ocr =  mistral.ocr.process(model="mistral-ocr-latest", document={
                "type": "image_url",
                "image_url": image_uri,
            }).pages[0].markdown
            print("F2 ended:", time.perf_counter())
            return ocr
        
        return await asyncio.to_thread(get_ocr)
    
    # For debugging purposes
    async def async_upload(self, image_uri):
        def upload():
            return cloudinary.uploader.upload(
                image_uri,
                public_id=f"waffy-inference-{time.time()}",
                overwrite=True
            )["secure_url"]
        
        imageUrl = await asyncio.to_thread(upload)
        print("IMAGE:", imageUrl)

proxy_handler_instance = CustomHandler()