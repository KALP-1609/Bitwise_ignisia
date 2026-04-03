"""
Automatic triggering logic based on visual motion detection.
"""

import cv2
import numpy as np
from app.core.config import settings

class MotionDetector:
    """
    Detects when an object has stopped moving within the field of view.
    """
    
    def __init__(self):
        self.previous_frame: np.ndarray = None
        
    def is_stationary(self, current_frame: np.ndarray) -> bool:
        """
        Determine if the scene is stationary between the current and previous frame.
        
        Converts frames to grayscale, computes absolute difference, and checks if
        the mean difference is below the configured MOTION_TOLERANCE_THRESHOLD.
        
        Args:
            current_frame (np.ndarray): The latest OpenCV BGR frame.
            
        Returns:
            bool: True if motion is below threshold (stationary), False otherwise.
        """
        if current_frame is None or current_frame.size == 0:
            return False
            
        # Convert the current frame to grayscale
        gray_frame = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
        
        # Apply slight blur to reduce noise
        gray_frame = cv2.GaussianBlur(gray_frame, (5, 5), 0)
        
        if self.previous_frame is None:
            self.previous_frame = gray_frame
            return False
            
        # Calculate the absolute difference between the current frame and previous frame
        frame_diff = cv2.absdiff(self.previous_frame, gray_frame)
        
        # Calculate the mean intensity difference across the frame
        mean_diff = np.mean(frame_diff)
        
        # Update the previous frame for the next check
        self.previous_frame = gray_frame
        
        # Check if the difference is below the configured threshold
        return mean_diff < settings.MOTION_TOLERANCE_THRESHOLD
