import asyncio
from contextlib import asynccontextmanager
import time
from typing import cast
from fastapi import FastAPI, Request
from pydantic import BaseModel
from util.omniparser import Omniparser
from util.utils import detect_device
from util.grider import Grider

config = {
    "som_model_path": "weights/icon_detect/model.pt",
    "caption_model_name": "florence2",
    "caption_model_path": "weights/icon_caption_florence",
    "device": detect_device(),
    "BOX_TRESHOLD": 0.25,
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.omniparser = Omniparser(config)
    app.state.grider = Grider()
    print("Lifespan set", app.state.omniparser, app.state.grider)
    yield

app = FastAPI(lifespan=lifespan)

class State:
    omniparser: Omniparser
    grider: Grider

class ParseRequest(BaseModel):
    image: str
    req_type: str

class Parser:
    def __init__(self, state):
        self.state = cast(State, state)
    
    async def screenshot_parser(self, image_base64: str):
        dino_labled_img, label_coordinates, parsed_content_list = self.state.omniparser.parse(image_base64)
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
        return {"image": annotated_image, "props": item_props}
    
    async def screenshot_parse(self, image):
        def parse():
            print("PARSER STARTED:", time.perf_counter())
            dino_labled_img, label_coordinates, parsed_content_list = self.state.omniparser.parse(image)
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
            print("PARSER ENDED:", time.perf_counter())
            return annotated_image, item_props
        
        return await asyncio.to_thread(parse)
    
    async def grid_parse(self, image):
        def parse():
            print("PARSER STARTED:", time.perf_counter())
            annotated_base64, grid_props = self.state.grider.parse(image)
            annotated_image = f"data:image/png;base64,{annotated_base64}"
            print("PARSER ENDED:", time.perf_counter())
            return annotated_image, grid_props
        
        return await asyncio.to_thread(parse)

@app.post("/inference")
async def inference(parse_request: ParseRequest, request: Request):
    app_state = cast(State, request.app.state)
    image_base64 = parse_request.image
    req_type = parse_request.req_type
    parser = Parser(app_state)
    if req_type == "screenshot":
        result = await parser.screenshot_parse(image_base64)
    elif req_type == "grid":
        result = await parser.grid_parse(image_base64)
    return {"image": result[0], "props": result[1]}

@app.get("/health")
async def health():
    return {"status": "healthy"}