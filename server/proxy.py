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

config = {
    "som_model_path": "weights/icon_detect/model.pt",
    "caption_model_name": "florence2",
    "caption_model_path": "weights/icon_caption_florence",
    "device": detect_device(),
    "BOX_TRESHOLD": 0.05,
}

omniparser = Omniparser(config)

cloudinary.config( 
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key = os.environ.get("CLOUDINARY_API_KEY"),
    api_secret = os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

mistral = Mistral(api_key=os.environ.get("MISTRAL_API_KEY"))

class MyCustomHandler(CustomLogger):
    def __init__(self):
        self.client_props = {}
        self.client_fc = {}

    async def async_pre_call_hook(self, user_api_key_dict: UserAPIKeyAuth, cache: DualCache, data: dict, call_type: Literal[
            "completion",
            "text_completion",
            "embeddings",
            "image_generation",
            "moderation",
            "audio_transcription",
        ]):
        data["tools"] = [
            {
                "type": "function",
                "name": "fetchScreen",
                "description": "Get the current page screenshot as annotated image.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "click",
                "description": "Simulate a click on the specified DOM element",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "elementId": {
                            "type": "number",
                            "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                        }
                    },
                    "required": ["elementId"],
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "typeText",
                "description": "Type text into the specified element",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "elementId": {
                            "type": "number",
                            "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                        },
                        "text": {
                            "type": "string",
                            "description": "The text to type"
                        }
                    },
                    "required": ["elementId", "text"],
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "enterKey",
                "description": "Send enter key to the page",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "getOption",
                "description": "Get all available options for the specified select element",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "elementId": {
                            "type": "number",
                            "description": "The ID of the specific element. DO NOT USE ANY RANDOM ID."
                        }
                    },
                    "required": ["elementId"],
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "setOption",
                "description": "Set the value of a specified select. Fetch the available options first.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "elementId": {
                            "type": "number",
                            "description": "The ID of the input element. DO NOT USE ANY RANDOM ID."
                        },
                        "value": {
                            "type": "string",
                            "description": "The value to set. DO NOT USE ANY RANDOM VALUE. ALWAYS USE THE VALUES RETURNED BY getOptions. FETCH THE AVAILABLE OPTIONS FIRST."
                        }
                    },
                    "required": ["elementId", "value"],
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "loadingState",
                "description": "Check whether the page is loading or fully loaded",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "goto",
                "description": "Navigate to a given URL in current tab.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to navigate to."
                        }
                    },
                    "required": ["url"],
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "open",
                "description": "Navigate to a given URL in new tab.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to navigate to."
                        }
                    },
                    "required": ["url"],
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "close",
                "description": "Closes the current tab",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "reload",
                "description": "Reloads the current tab",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "checkScrollbar",
                "description": "Check whether the page is scrollable or not. Returns scroll position if it is scrollable.",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "scroll",
                "description": "Scrolls the page in the specified direction and returns the current scrollbar position",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "direction": {
                            "type": "string",
                            "enum": ["up", "down", "left", "right"],
                            "description": "The direction to scroll"
                        }
                    },
                    "required": ["direction"],
                    "additionalProperties": False
                }
            },
            {
                "type": "function",
                "name": "wait",
                "description": "Wait for a specified amount of time",
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "ms": {
                            "type": "number",
                            "description": "The amount of time to wait in milliseconds"
                        }
                    },
                    "required": ["ms"],
                    "additionalProperties": False
                }
            },
        ]
        data["parallel_tool_calls"] = False
        data["tool_choice"] = "auto"
        data["truncation"] = "auto"

        screenshot_req = False
        parser_tasks = []
        upload_tasks = []
        ocr_tasks = []
        metadata = {}

        for index, messages in enumerate(data["input"]):
            messages = dict(messages)
            if ("type" in messages and messages["type"] == "screenshot"):
                screenshot_req = True
                original_image = f"data:image/png;base64,{messages['image']}"
                parser_task = self.async_parse(messages["image"])
                result = (await asyncio.gather(parser_task))[0]
                annotated_image, item_props = result
                upload_task = self.async_upload(annotated_image)
                ocr_task = self.async_ocr(original_image)
                parser_tasks.append(parser_task)
                upload_tasks.append(upload_task)
                ocr_tasks.append(ocr_task)
                metadata[index] = messages["metadata"]
                self.client_props[data["metadata"]["client_id"]] = {"meta": messages["metadata"], "props": item_props}

        if (screenshot_req):
            image_url = await asyncio.gather(*[task for task in upload_tasks])
            ocr_content = await asyncio.gather(*[task for task in ocr_tasks])
            for index, image, ocr in zip(metadata, image_url, ocr_content):
                meta = metadata[index]
                data["input"].pop(index)
                data["input"].append({
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": f"<PAGE_METDATA><PAGE_URL>{meta['url']}</PAGE_URL><PAGE_TITLE>{meta['title']}</PAGE_TITLE></PAGE_METDATA><PAGE_OCR_CONTENT>{ocr}</PAGE_OCR_CONTENT>"
                        },
                        {
                            "type": "input_image",
                            "image_url": image
                        }
                    ]
                })
        
        # print("justx:", data["input"])
        return data
    
    async def async_post_call_streaming_iterator_hook(self, user_api_key_dict, response, request_data):
        async for data in response:
            data_dict = dict(data)
            if ("type" in data_dict and "item" in data_dict and data_dict["type"] == "response.output_item.done"):
                item = dict(data_dict["item"])
                if ("type" in item and item["type"] == "function_call"):
                    toolName = item["name"]
                    toolArgs = json.loads(item["arguments"])
                    if ("elementId" in toolArgs):
                        element_id = toolArgs["elementId"]
                        props = self.client_props[request_data["metadata"]["client_id"]]["props"]
                        target = list(filter(lambda e: e["id"] == str(element_id), props))[0] if props else None
                        devicePixelRatio = self.client_props[request_data["metadata"]["client_id"]]["meta"]["pixelRatio"]
                        if target:
                            x = target["x"]
                            y = target["y"]
                            click_cords_x = (x + target["width"] / 2) / devicePixelRatio
                            click_cords_y = (y + target["height"] / 2) / devicePixelRatio
                            item["arguments"] = json.dumps({
                                "x": click_cords_x,
                                "y": click_cords_y
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
                print("xrrrgs:", data_dict)
                yield type(data)(**data_dict)
                continue

            yield data

    async def async_parse(self, image):
        def parse():
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
            return annotated_image, item_props
        annotated_image, item_props = await asyncio.to_thread(parse)
        return annotated_image, item_props

    async def async_upload(self, image):
        def upload():
            return cloudinary.uploader.upload(
                image,
                public_id=f"waffy-inference-{time.time()}",
                overwrite=True
            )["secure_url"]
        imageUrl = await asyncio.to_thread(upload)
        return imageUrl
    
    async def async_ocr(self, image):
        def get_ocr():
            return mistral.ocr.process(model="mistral-ocr-latest", document={
                "type": "image_url",
                "image_url": image,
            })
        ocr_response = await asyncio.to_thread(get_ocr)
        return ocr_response.pages[0].markdown

proxy_handler_instance = MyCustomHandler()