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
from util.grider import Grider
import cloudinary
import cloudinary.uploader
from instructions import T1_PROMPT, T2_PROMPT, T3_PROMPT, T4_PROMPT, T1_TOOLS, T2_TOOLS, T3_TOOLS, TITLE_PROMPT
from redis import Redis
from supabase import create_client, Client
import socketio

DEBUG = False

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

sio = socketio.Client()

sio.connect("http://localhost:8000", auth={"server": True})

omniparser = Omniparser(config)
grider = Grider()

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
                client_id = data["metadata"]["client_id"]
                
                if (data["handler"] == "t1"):
                    # data["model"] = "o3-pro"
                    data["model"] = "gpt-4.1"
                    data["tools"] = T1_TOOLS
                    data["stream"] = True
                    data["temperature"] = 0.5
                    # data["reasoning"] = {"effort": "low", "summary": "detailed"}
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T1_PROMPT}]

                elif (data["handler"] == "t2"):
                    # data["model"] = "o3-pro"
                    data["model"] = "gpt-4.1"
                    data["tools"] = T2_TOOLS
                    data["stream"] = True
                    data["temperature"] = 0
                    # data["reasoning"] = {"effort": "high", "summary": "detailed"}
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T2_PROMPT}]

                elif (data["handler"] == "t3"):
                    data["model"] = "gpt-4.1"
                    data["tools"] = T3_TOOLS
                    data["stream"] = True
                    data["temperature"] = 0.1
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

                request_type = None
                parser_tasks = []
                metadata = {}
                grider_tasks = []

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
                                file = msg["payload"]
                                file_content = file["content"]
                                mime_type = file["mimeType"]
                                data_uri = f"data:{mime_type};base64,{file_content}"
                                if file["mimeType"].startswith("image"):
                                    content.append({ "type": "output_image", "image_url": data_uri })
                                else:
                                    content.append({ "type": "output_file", "filename": file["name"], "file_data": data_uri })
                        data["input"].append({ "role": "assistant", "content": content })
                    elif ("type" in messages and messages["type"] == "screenshot" and data["handler"] == "t2"):
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
                        data["input"].append(messages)

                print("REQUEST_TYPE:", request_type)
                if (request_type == "screenshot"):
                    # Inject annotated screenshot
                    start_time = time.perf_counter()
                    print("Main Start:", start_time)
                    parser_content = await asyncio.gather(*parser_tasks, return_exceptions=True)
                    print("Main End:", time.perf_counter())
                    print("Total Time:", time.perf_counter() - start_time)
                    for index, (image, props) in zip(metadata, parser_content):
                        print("Screenindex:", index)
                        page_meta = metadata[index]
                        await asyncio.gather(self.async_upload(image)) if DEBUG else None
                        self.client_props[client_id] = {**self.client_props.get(client_id, {}), "metadata": page_meta, "fetch_props": props}
                        # Emit highlight_client event
                        # sio.emit("highlight_client", {
                        #     "client_id": client_id,
                        #     "data": self.client_props.get(client_id, {}).get("fetch_props", {})
                        # })
                        # Consider system prompt while inserting
                        data["input"].insert(index + 1, {
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
                    start_time = time.perf_counter()
                    print("Main Start:", start_time)
                    results = await asyncio.gather(*grider_tasks, return_exceptions=True)
                    for index, (image, props) in zip(metadata, results):
                        page_meta = metadata[index]
                        await asyncio.gather(self.async_upload(image)) if DEBUG else None
                        self.client_props[client_id] = {**self.client_props.get(client_id, {}), "metadata": page_meta, "scroll_props": props}
                        # Consider system prompt while inserting
                        data["input"].insert(index + 1, {
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
                    print("Main End:", time.perf_counter())
                    print("Total Time:", time.perf_counter() - start_time)

                del data["data"]
                
            if ("title" in data):
                data["model"] = "gpt-4.1-nano"
                data["stream"] = False
                data["input"] = [{'role': 'system', 'content': TITLE_PROMPT}, { "role": "user", "content": data["title"] }]
                del data["title"]
        
            return data
        
        except Exception as e:
            print("PRE-ERROR:", e)
        
    
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
                        print("TOOL_ARGS:", toolArgs)
                        if ("elementId" in toolArgs):
                            element_id = toolArgs["elementId"]
                            props = self.client_props[request_data["metadata"]["client_id"]]["fetch_props"]
                            coords = self.id_to_coords(element_id, props, request_data["metadata"]["client_id"])
                            if coords:
                                toolArgs.pop("elementId")
                                item["arguments"] = json.dumps({
                                    "x": coords["x"],
                                    "y": coords["y"],
                                    **toolArgs
                                })
                                self.client_fc[item["id"]] = item
                                data_dict["item"] = item
                                yield type(data)(**data_dict)
                                continue
                        elif ("portionId" in toolArgs):
                            portion_id = toolArgs["portionId"]
                            props = self.client_props[request_data["metadata"]["client_id"]]["scroll_props"]
                            coords = self.id_to_coords(portion_id, props, request_data["metadata"]["client_id"])
                            if coords:
                                toolArgs.pop("portionId")
                                item["arguments"] = json.dumps({
                                    "x": coords["x"],
                                    "y": coords["y"],
                                    **toolArgs
                                })
                                self.client_fc[item["id"]] = item
                                data_dict["item"] = item
                                yield type(data)(**data_dict)
                                continue
                elif ("type" in data_dict and data_dict["type"] == "response.function_call_arguments.delta" or data_dict["type"] == "response.function_call_arguments.done"):
                    continue
                elif ("type" in data_dict and data_dict["type"] == "response.completed" and "response" in data_dict and "metadata" in data_dict["response"] and "mode" in data_dict["response"]["metadata"] and data_dict["response"]["metadata"]["mode"] == "t3"):
                    # call stepgenerator
                    yield type(data)(**data_dict)
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

                yield data
            
            except Exception as e:
                print("POST-ERROR:", e)
    
    def id_to_coords(self, id, props, client_id):
        target = list(filter(lambda e: e["id"] == id, props))[0] if props else None
        devicePixelRatio = self.client_props[client_id]["metadata"]["pixelRatio"]
        if target:
            coords_x = (target["x"] + target["width"] / 2) / devicePixelRatio
            coords_y = (target["y"] + target["height"] / 2) / devicePixelRatio
            print("CONVERTING ID:", id, "  X:", coords_x, "  Y:", coords_y) if DEBUG else None
            return {"x": coords_x, "y": coords_y}
        else:
            return False
    
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
    
    async def async_screenshot_parse(self, image):
        def parse():
            print("F1 started:", time.perf_counter())
            dino_labled_img, label_coordinates, parsed_content_list = omniparser.parse(image)
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
            annotated_base64, grid_props = grider.parse(image)
            annotated_image = f"data:image/png;base64,{annotated_base64}"
            print("P1 ended:", time.perf_counter())
            return annotated_image, grid_props
        
        return await asyncio.to_thread(parse)
    
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