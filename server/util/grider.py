import cv2
import base64
import numpy as np

class Grider(object):
    def parse(self, image_base64: str) -> str:
        image_bytes = base64.b64decode(image_base64)
        nparr = np.frombuffer(image_bytes, np.uint8)

        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise Exception("Error: Could not decode image data. The data may be corrupt or not an image.")

        h, w, _ = image.shape

        overlay = np.full(image.shape, (144, 238, 144), dtype=np.uint8)
        alpha = 0.5
        beta = 1 - alpha
        image = cv2.addWeighted(overlay, alpha, image, beta, 0)

        # Grid properties
        rows, cols = 8, 8
        box_h = h // rows
        box_w = w // cols

        # Border properties
        border_color = (0, 0, 255)
        border_thickness = 2

        # Font properties
        text_color = (0, 0, 0)
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = min(box_w, box_h) / 180
        font_thickness = 3

        box_number = 1
        props = []

        for i in range(rows):
            for j in range(cols):
                start_point = (j * box_w, i * box_h)
                end_point = ((j + 1) * box_w, (i + 1) * box_h)

                props.append({
                    "id": box_number,
                    "x": (start_point[0] + end_point[0]) // 2,
                    "y": (start_point[1] + end_point[1]) // 2,
                    "width": end_point[0] - start_point[0],
                    "height": end_point[1] - start_point[1],
                })

                cv2.rectangle(image, start_point, end_point, border_color, border_thickness)
                text = str(box_number)
                text_size, _ = cv2.getTextSize(text, font, font_scale, font_thickness)
                text_x = start_point[0] + (box_w - text_size[0]) // 2
                text_y = start_point[1] + (box_h + text_size[1]) // 2
                bg_start_x = text_x - 10
                bg_start_y = text_y - text_size[1] - 10
                bg_end_x = text_x + text_size[0] + 10
                bg_end_y = text_y + 10
                cv2.rectangle(image, (bg_start_x, bg_start_y), (bg_end_x, bg_end_y), (255, 255, 255), cv2.FILLED)
                cv2.putText(image, text, (text_x, text_y), font, font_scale, text_color, font_thickness)
                box_number += 1

        _, buffer = cv2.imencode('.png', image)
        annotated_base64 = base64.b64encode(buffer).decode('utf-8')
        return annotated_base64, props
