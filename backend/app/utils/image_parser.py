"""
Image parsing and conversion utilities.
"""

import base64
import numpy as np
import cv2

def base64_to_cv2(base64_string: str) -> np.ndarray:
    """
    Converts a base64 encoded image string to a OpenCV numpy array.
    
    Handles and strips frontend data URI prefixes (e.g., "data:image/jpeg;base64,").
    
    Args:
        base64_string (str): The base64 encoded image string.
        
    Returns:
        np.ndarray: The decoded image as an OpenCV BGR numpy array.
        
    Raises:
        ValueError: If the base64 string is invalid or cannot be decoded into an image.
    """
    try:
        # Strip data URI prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",", 1)[1]
            
        # Decode base64 string to bytes
        img_bytes = base64.b64decode(base64_string)
        
        # Convert bytes to numpy array
        np_arr = np.frombuffer(img_bytes, np.uint8)
        
        # Decode numpy array to OpenCV image
        img_cv2 = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img_cv2 is None:
            raise ValueError("Failed to decode image from the provided base64 data.")
            
        return img_cv2
        
    except Exception as e:
        raise ValueError(f"Error converting base64 to cv2 image: {str(e)}")

def cv2_to_base64(cv2_image_array: np.ndarray) -> str:
    """
    Converts an OpenCV numpy array back to a base64 jpeg string.
    
    Args:
        cv2_image_array (np.ndarray): The OpenCV BGR image array.
        
    Returns:
        str: The base64 encoded jpeg image string.
        
    Raises:
        ValueError: If the image cannot be encoded to jpeg.
    """
    try:
        # Encode image to JPEG
        success, buffer = cv2.imencode(".jpg", cv2_image_array)
        
        if not success:
            raise ValueError("Failed to encode cv2 image to JPEG.")
            
        # Convert to base64 string
        base64_bytes = base64.b64encode(buffer)
        base64_string = base64_bytes.decode("utf-8")
        
        return base64_string
        
    except Exception as e:
        raise ValueError(f"Error converting cv2 image to base64: {str(e)}")
