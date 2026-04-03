"""
Module to bridge the backend to the external ML inference engine.
"""

import random
from typing import List, Tuple
import numpy as np

async def calibrate_model(images_cv2: List[np.ndarray], profile_name: str) -> bool:
    """
    Mocks sending reference images to the ML Engine to calibrate a new profile.
    
    Args:
        images_cv2 (List[np.ndarray]): A list of reference images.
        profile_name (str): The name of the profile to calibrate.
        
    Returns:
        bool: Always returns True in this mocked implementation.
    """
    # Mocking successful calibration
    return True

async def run_inference(frame_cv2: np.ndarray, profile_name: str) -> Tuple[bool, np.ndarray]:
    """
    Mocks running visual inspection inference on the specified frame.
    
    Args:
        frame_cv2 (np.ndarray): The camera frame to inspect.
        profile_name (str): The associated profile for inspection scoring.
        
    Returns:
        Tuple[bool, np.ndarray]:
            - bool: A mocked detection result (True if defective, False if pass).
            - np.ndarray: The original image returned as a mock heatmap.
    """
    # Mock defect randomly (True or False)
    is_defective = random.choice([True, False])
    
    # Mock heatmap as the original image unmodified
    return is_defective, frame_cv2
