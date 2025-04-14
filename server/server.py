import sys
import os
import time
from fastapi import FastAPI, File, UploadFile
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
import argparse
import uvicorn
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(root_dir)
from util.omniparser import Omniparser
from util.utils import detect_device
import cloudinary
import cloudinary.uploader
from mistralai import Mistral
from dotenv import load_dotenv

load_dotenv()

cloudinary.config( 
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key = os.environ.get("CLOUDINARY_API_KEY"),
    api_secret = os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

mistral = Mistral(api_key=os.environ.get("MISTRAL_API_KEY"))

def parse_arguments():
    parser = argparse.ArgumentParser(description='Omniparser API')
    parser.add_argument('--som_model_path', type=str, default='weights/icon_detect/model.pt', help='Path to the som model')
    parser.add_argument('--caption_model_name', type=str, default='florence2', help='Name of the caption model')
    parser.add_argument('--caption_model_path', type=str, default='weights/icon_caption_florence', help='Path to the caption model')
    parser.add_argument('--device', type=str, default=detect_device(), help='Device to run the model')
    parser.add_argument('--BOX_TRESHOLD', type=float, default=0.05, help='Threshold for box detection')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host for the API')
    parser.add_argument('--port', type=int, default=8000, help='Port for the API')
    args = parser.parse_args()
    return args

args = parse_arguments()
config = vars(args)

app = FastAPI()
omniparser = Omniparser(config)

class ParseRequest(BaseModel):
    image: str

@app.post("/inference")
def parse(parse_request: ParseRequest):
    print('start parsing...')
    start = time.time()
    ocr_response = mistral.ocr.process(model="mistral-ocr-latest", document={
        "type": "image_url",
        "image_url": f"data:image/png;base64,{parse_request.image}",
    })
    dino_labled_img, label_coordinates, parsed_content_list = omniparser.parse(parse_request.image)
    latency = time.time() - start
    print('time:', latency)
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
    image_base64 = f"data:image/png;base64,{dino_labled_img}"
    imageUrl = cloudinary.uploader.upload(image_base64, public_id=f"waffy-inference-{start}", overwrite=True)["secure_url"]
    return {"image_url": imageUrl, "ocr_response": ocr_response.pages[0].markdown, "props": jsonable_encoder(item_props), "latency": latency}

@app.post("/upload")
def upload_file(file: UploadFile = File(...)):
    res_url = cloudinary.uploader.upload(file.file, public_id=f"waffy-file-{time.time()}", overwrite=True)
    return {"url": res_url["secure_url"]}

@app.get("/")
def root():
    return {"message": "API Server Ready"}

if __name__ == "__main__":
    uvicorn.run(app, host=args.host, port=args.port)