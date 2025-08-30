import requests

ENDPOINT_URL = "https://inference01-endpoint.upzare.com/inference"

class ScreenshotParser:
    @staticmethod
    def process(image_base64: str):
        json_data = {
            "image": image_base64,
            "req_type": "screenshot"
        }
        response = requests.post(ENDPOINT_URL, json=json_data)
        print("RESSS:", response)
        if response.ok:
            response_json = response.json()
            print(response_json)
            return response_json["image"], response_json["props"]
        else:
            raise Exception("Error: Could not parse image.")

class GridParser:
    @staticmethod
    def process(image_base64: str):
        json_data = {
            "image": image_base64,
            "req_type": "grid"
        }
        response = requests.post(ENDPOINT_URL, json=json_data)
        if response.ok:
            response_json = response.json()
            return response_json["image"], response_json["props"]
        else:
            raise Exception("Error: Could not parse image.")