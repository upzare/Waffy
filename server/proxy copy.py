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
from instructions import T1_PROMPT, T2_PROMPT, T3_PROMPT, T1_TOOLS, T3_TOOLS, TITLE_PROMPT

DEBUG = True

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

class CustomHandler(CustomLogger):
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
        try:
            if ("handler" in data):
                if (data["handler"] == "t1"):
                    data["model"] = "gpt-4o-mini"
                    data["tools"] = T1_TOOLS
                    data["stream"] = True
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T1_PROMPT}]

                elif (data["handler"] == "t2"):
                    data["model"] = "gpt-4o-mini"
                    data["stream"] = True
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T2_PROMPT}]

                elif (data["handler"] == "t3"):
                    data["model"] = "gpt-4o"
                    data["tools"] = T3_TOOLS
                    data["stream"] = True
                    data["parallel_tool_calls"] = False
                    data["tool_choice"] = "auto"
                    data["truncation"] = "auto"
                    data["input"] = [{'role': 'system', 'content': T3_PROMPT}]

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
                        screenshot_req = True
                        parser_task = self.async_parse(messages["image"])
                        ocr_task = self.async_ocr(messages['image'])
                        parser_tasks.append(parser_task)
                        ocr_tasks.append(ocr_task)
                        metadata[index] = messages["metadata"]

                if (screenshot_req):
                    parser_content = await asyncio.gather(*[task for task in parser_tasks])
                    ocr_content = await asyncio.gather(*[task for task in ocr_tasks])
                    for index, (image, props), ocr in zip(metadata, parser_content, ocr_content):
                        meta = metadata[index]
                        print("IMAGE:", (await asyncio.gather(self.async_upload(image)))[0]) if DEBUG else None
                        self.client_props[data["metadata"]["client_id"]] = { "meta": messages["metadata"], "props": props }
                        data["input"].append({
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
                    yield type(data)(**data_dict)
                    continue
            except Exception as e:
                print("POST-ERROR:", e)

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
    
    async def async_ocr(self, image):
        image_uri = f"data:image/png;base64,{image}"
        def get_ocr():
            return mistral.ocr.process(model="mistral-ocr-latest", document={
                "type": "image_url",
                "image_url": image_uri,
            })
        ocr_response = await asyncio.to_thread(get_ocr)
        return ocr_response.pages[0].markdown
    
    # For debugging purposes
    async def async_upload(self, image_uri):
        def upload():
            return cloudinary.uploader.upload(
                image_uri,
                public_id=f"waffy-inference-{time.time()}",
                overwrite=True
            )["secure_url"]
        imageUrl = await asyncio.to_thread(upload)
        return imageUrl

proxy_handler_instance = CustomHandler()