from typing import List, Optional, Union, Tuple

import cv2
import numpy as np

from supervision.detection.core import Detections
from supervision.draw.color import Color, ColorPalette


class BoxAnnotator:
    """
    A class for drawing bounding boxes on an image using detections provided.

    Attributes:
        color (Union[Color, ColorPalette]): The color to draw the bounding box,
            can be a single color or a color palette
        thickness (int): The thickness of the bounding box lines, default is 2
        text_color (Color): The color of the text on the bounding box, default is white
        text_scale (float): The scale of the text on the bounding box, default is 0.5
        text_thickness (int): The thickness of the text on the bounding box,
            default is 1
        text_padding (int): The padding around the text on the bounding box,
            default is 5

    """

    def __init__(
        self,
        color: Union[Color, ColorPalette] = ColorPalette.DEFAULT,
        thickness: int = 3, # 1 for seeclick 2 for mind2web and 3 for demo
        text_color: Color = Color.BLACK,
        text_scale: float = 0.5, # 0.8 for mobile/web, 0.3 for desktop # 0.4 for mind2web
        text_thickness: int = 2, #1, # 2 for demo
        text_padding: int = 10,
        avoid_overlap: bool = True,
    ):
        self.color: Union[Color, ColorPalette] = color
        self.thickness: int = thickness
        self.text_color: Color = text_color
        self.text_scale: float = text_scale
        self.text_thickness: int = text_thickness
        self.text_padding: int = text_padding
        self.avoid_overlap: bool = avoid_overlap

    def annotate(
        self,
        scene: np.ndarray,
        detections: Detections,
        labels: Optional[List[str]] = None,
        skip_label: bool = False,
        image_size: Optional[Tuple[int, int]] = None,
    ) -> np.ndarray:
        """
        Draws bounding boxes on the frame using the detections provided.

        Args:
            scene (np.ndarray): The image on which the bounding boxes will be drawn
            detections (Detections): The detections for which the
                bounding boxes will be drawn
            labels (Optional[List[str]]): An optional list of labels
                corresponding to each detection. If `labels` are not provided,
                corresponding `class_id` will be used as label.
            skip_label (bool): Is set to `True`, skips bounding box label annotation.
        Returns:
            np.ndarray: The image with the bounding boxes drawn on it

        Example:
            ```python
            import supervision as sv

            classes = ['person', ...]
            image = ...
            detections = sv.Detections(...)

            box_annotator = sv.BoxAnnotator()
            labels = [
                f"{classes[class_id]} {confidence:0.2f}"
                for _, _, confidence, class_id, _ in detections
            ]
            annotated_frame = box_annotator.annotate(
                scene=image.copy(),
                detections=detections,
                labels=labels
            )
            ```
        """
        font = cv2.FONT_HERSHEY_SIMPLEX
        label_drawings = []  # Collect label drawing instructions

        for i in range(len(detections)):
            x1, y1, x2, y2 = detections.xyxy[i].astype(int)
            class_id = (
                detections.class_id[i] if detections.class_id is not None else None
            )
            idx = class_id if class_id is not None else i
            color = (
                self.color.by_idx(idx)
                if isinstance(self.color, ColorPalette)
                else self.color
            )
            # Draw the box first
            cv2.rectangle(
                img=scene,
                pt1=(x1, y1),
                pt2=(x2, y2),
                color=color.as_bgr(),
                thickness=self.thickness,
            )
            if skip_label:
                continue

            text = (
                f"{class_id}"
                if (labels is None or len(detections) != len(labels))
                else labels[i]
            )

            text_width, text_height = cv2.getTextSize(
                text=text,
                fontFace=font,
                fontScale=self.text_scale,
                thickness=self.text_thickness,
            )[0]

            if not self.avoid_overlap:
                text_x = x1 + self.text_padding
                text_y = y1 - self.text_padding

                text_background_x1 = x1
                text_background_y1 = y1 - 2 * self.text_padding - text_height

                text_background_x2 = x1 + 2 * self.text_padding + text_width
                text_background_y2 = y1
                # text_x = x1 - self.text_padding - text_width
                # text_y = y1 + self.text_padding + text_height
                # text_background_x1 = x1 - 2 * self.text_padding - text_width
                # text_background_y1 = y1
                # text_background_x2 = x1
                # text_background_y2 = y1 + 2 * self.text_padding + text_height
            else:
                text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2 = get_optimal_label_pos(
                    self.text_padding, text_width, text_height, x1, y1, x2, y2, detections, image_size
                )

            box_color = color.as_rgb()
            luminance = 0.299 * box_color[0] + 0.587 * box_color[1] + 0.114 * box_color[2]
            text_color = (0,0,0) if luminance > 160 else (255,255,255)

            # Collect label drawing instructions
            label_drawings.append({
                "background": {
                    "pt1": (text_background_x1, text_background_y1),
                    "pt2": (text_background_x2, text_background_y2),
                    "color": color.as_bgr()
                },
                "text": {
                    "text": text,
                    "org": (text_x, text_y),
                    "fontFace": font,
                    "fontScale": self.text_scale,
                    "color": text_color,
                    "thickness": self.text_thickness,
                    "lineType": cv2.LINE_AA
                }
            })

        # Draw all labels after all boxes (ensures labels are on top)
        for label in label_drawings:
            cv2.rectangle(
                img=scene,
                pt1=label["background"]["pt1"],
                pt2=label["background"]["pt2"],
                color=label["background"]["color"],
                thickness=cv2.FILLED,
            )
            cv2.putText(
                img=scene,
                text=label["text"]["text"],
                org=label["text"]["org"],
                fontFace=label["text"]["fontFace"],
                fontScale=label["text"]["fontScale"],
                color=label["text"]["color"],
                thickness=label["text"]["thickness"],
                lineType=label["text"]["lineType"],
            )
        return scene
    

def box_area(box):
        return (box[2] - box[0]) * (box[3] - box[1])

def intersection_area(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    return max(0, x2 - x1) * max(0, y2 - y1)

def IoU(box1, box2, return_max=True):
    intersection = intersection_area(box1, box2)
    union = box_area(box1) + box_area(box2) - intersection
    if box_area(box1) > 0 and box_area(box2) > 0:
        ratio1 = intersection / box_area(box1)
        ratio2 = intersection / box_area(box2)
    else:
        ratio1, ratio2 = 0, 0
    if return_max:
        return max(intersection / union, ratio1, ratio2)
    else:
        return intersection / union


def get_optimal_label_pos(text_padding, text_width, text_height, x1, y1, x2, y2, detections, image_size):
    """ check overlap of text and background detection box, and get_optimal_label_pos, 
        pos: str, position of the text, must be one of 'top left', 'top right', 'outer left', 'outer right', 'bottom left', 'bottom right'
        Threshold: default to 0.3
    """

    def get_is_overlap(detections, text_background_x1, text_background_y1, text_background_x2, text_background_y2, image_size):
        is_overlap = False
        for i in range(len(detections)):
            detection = detections.xyxy[i].astype(int)
            if IoU([text_background_x1, text_background_y1, text_background_x2, text_background_y2], detection) > 0.01:
                is_overlap = True
                break
        # check if the text is out of the image
        if text_background_x1 < 5 or text_background_x2 > (image_size[0] - 5) or text_background_y1 < 5 or text_background_y2 > (image_size[1] - 5):
            is_overlap = True
        return is_overlap
    
    # top left
    text_x = x1 + text_padding
    text_y = y1 - text_padding
    text_background_x1 = x1
    text_background_y1 = y1 - 2 * text_padding - text_height
    text_background_x2 = x1 + 2 * text_padding + text_width
    text_background_y2 = y1
    is_overlap = get_is_overlap(detections, text_background_x1, text_background_y1 - 5, text_background_x2, text_background_y2, image_size)
    if not is_overlap:
        return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2
    
    # top right
    text_x = x2 - text_padding - text_width
    text_y = y1 - text_padding
    text_background_x1 = x2 - 2 * text_padding - text_width
    text_background_y1 = y1 - 2 * text_padding - text_height
    text_background_x2 = x2
    text_background_y2 = y1
    is_overlap = get_is_overlap(detections, text_background_x1, text_background_y1 - 5, text_background_x2, text_background_y2, image_size)
    if not is_overlap:
        return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2
    
    # outer left
    text_x = x1 - text_padding - text_width
    text_y = y1 + text_padding + text_height
    text_background_x1 = x1 - 2 * text_padding - text_width
    text_background_y1 = y1
    text_background_x2 = x1
    text_background_y2 = y1 + 2 * text_padding + text_height
    is_overlap = get_is_overlap(detections, text_background_x1 - 5, text_background_y1 - 10, text_background_x2, text_background_y2, image_size)
    if not is_overlap:
        return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2
    
    # outer right
    text_x = x2 + text_padding
    text_y = y1 + text_padding + text_height
    text_background_x1 = x2
    text_background_y1 = y1
    text_background_x2 = x2 + 2 * text_padding + text_width
    text_background_y2 = y1 + 2 * text_padding + text_height
    is_overlap = get_is_overlap(detections, text_background_x1, text_background_y1 - 10, text_background_x2 + 5, text_background_y2, image_size)
    if not is_overlap:
        return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2

    # bottom left
    text_x = x1 + text_padding
    text_y = y2 + text_padding + text_height
    text_background_x1 = x1
    text_background_y1 = y2
    text_background_x2 = x1 + 2 * text_padding + text_width
    text_background_y2 = y2 + 2 * text_padding + text_height
    is_overlap = get_is_overlap(detections, text_background_x1, text_background_y1, text_background_x2, text_background_y2 + 15, image_size)
    if not is_overlap:
        return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2

    # bottom right
    text_x = x2 - text_padding - text_width
    text_y = y2 + text_padding + text_height
    text_background_x1 = x2 - 2 * text_padding - text_width
    text_background_y1 = y2
    text_background_x2 = x2
    text_background_y2 = y2 + 2 * text_padding + text_height
    is_overlap = get_is_overlap(detections, text_background_x1, text_background_y1, text_background_x2, text_background_y2 + 15, image_size)
    if not is_overlap:
        return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2

    # Outer right or left center depending on nearest element
    center_y = (y1 + y2) // 2 + text_height // 2
    min_right_dist = float('inf')
    min_left_dist = float('inf')
    for i in range(len(detections)):
        det = detections.xyxy[i].astype(int)
        if det[0] == x1 and det[1] == y1 and det[2] == x2 and det[3] == y2:
            continue
        # Right: detection's left edge is to the right of this box's right edge
        if det[0] >= x2:
            dist = det[0] - x2
            if dist < min_right_dist:
                min_right_dist = dist
        # Left: detection's right edge is to the left of this box's left edge
        if det[2] <= x1:
            dist = x1 - det[2]
            if dist < min_left_dist:
                min_left_dist = dist

    # If nearest element is on right, display on outer left center
    # If nearest element is on left, display on outer right center
    if min_right_dist < min_left_dist:
        # outer left center
        text_x = x1 - text_padding - text_width
        text_y = center_y
        text_background_x1 = x1 - 2 * text_padding - text_width
        text_background_y1 = (y1 + y2) // 2 - text_height // 2 - text_padding
        text_background_x2 = x1
        text_background_y2 = (y1 + y2) // 2 + text_height // 2 + text_padding
    else:
        # outer right center
        text_x = x2 + text_padding
        text_y = center_y
        text_background_x1 = x2
        text_background_y1 = (y1 + y2) // 2 - text_height // 2 - text_padding
        text_background_x2 = x2 + 2 * text_padding + text_width
        text_background_y2 = (y1 + y2) // 2 + text_height // 2 + text_padding

    is_overlap = get_is_overlap(
        detections,
        text_background_x1,
        text_background_y1,
        text_background_x2,
        text_background_y2,
        image_size,
    )
    if not is_overlap:
        return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2

    # inner center top
    text_x = (x1 + x2) // 2 - text_width // 2
    text_y = y1 + text_padding + text_height
    text_background_x1 = (x1 + x2) // 2 - text_width // 2 - text_padding
    text_background_y1 = y1
    text_background_x2 = (x1 + x2) // 2 + text_width // 2 + text_padding
    text_background_y2 = y1 + 2 * text_padding + text_height

    # fallback: last tried (inner center top)
    return text_x, text_y, text_background_x1, text_background_y1, text_background_x2, text_background_y2
