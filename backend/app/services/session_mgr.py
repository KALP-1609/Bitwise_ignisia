"""
Session management for ongoing inspection operations.
"""

import time
from typing import Dict, Any

class InspectionSession:
    """
    Singleton class managing the state of an active product inspection session.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(InspectionSession, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
        
    def _initialize(self) -> None:
        """Initialize session state."""
        self.active_profile: str = ""
        self.total_scanned: int = 0
        self.passed: int = 0
        self.failed: int = 0
        self.last_scan_time: float = 0.0
        
    def set_active_profile(self, name: str) -> None:
        """
        Set the active scoring profile and reset session statistics.
        
        Args:
            name (str): The name of the profile to activate.
        """
        self.active_profile = name
        self.total_scanned = 0
        self.passed = 0
        self.failed = 0
        self.last_scan_time = 0.0
        
    def can_scan(self) -> bool:
        """
        Check if a enough time has elapsed to perform a new scan.
        Enforces a 2.0-second cooldown to prevent double-counting.
        
        Returns:
            bool: True if safe to scan, False otherwise.
        """
        current_time = time.time()
        if (current_time - self.last_scan_time) >= 2.0:
            return True
        return False
        
    def update_stats(self, is_defective: bool) -> None:
        """
        Update session statistics following an inspection and update last scan time.
        
        Args:
            is_defective (bool): True if the inspected item was defective, False otherwise.
        """
        self.total_scanned += 1
        if is_defective:
            self.failed += 1
        else:
            self.passed += 1
            
        self.last_scan_time = time.time()
        
    def get_stats(self) -> Dict[str, Any]:
        """
        Retrieve the current inspection session statistics.
        
        Returns:
            dict: Dictionary with total_scanned, passed, failed, and defect_rate.
        """
        defect_rate = (self.failed / self.total_scanned * 100.0) if self.total_scanned > 0 else 0.0
        
        return {
            "total_scanned": self.total_scanned,
            "passed": self.passed,
            "failed": self.failed,
            "defect_rate": round(defect_rate, 2),
            "active_profile": self.active_profile
        }

# Global instance for easy import
session_mgr = InspectionSession()
