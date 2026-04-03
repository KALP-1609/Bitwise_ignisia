import os
import warnings
import cv2
import numpy as np
from anomalib.deploy import OpenVINOInferencer, TorchInferencer

# allow local model loading and mute the legacy warnings
os.environ["TRUST_REMOTE_CODE"] = "1"
warnings.filterwarnings("ignore")

# cache models in RAM so we don't fry the CPU reloading them every frame
ACTIVE_INFERENCERS = {}

def find_model_file(base_dir: str, filename_or_ext: str) -> str:
    # anomalib likes to bury files in random subfolders, so we just recursively hunt for it
    if not os.path.exists(base_dir): return None
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.endswith(filename_or_ext): return os.path.join(root, file)
    return None

def load_inferencer(profile_name: str):
    if profile_name not in ACTIVE_INFERENCERS:
        base_dir = os.path.abspath(f"../backend/app/ml_bridge/memory_banks/{profile_name}")
        openvino_path = find_model_file(base_dir, "model.xml")
        torch_path = find_model_file(base_dir, "model.pt")

        try:
            # prefer openvino for speed, fallback to torchscript
            if openvino_path:
                ACTIVE_INFERENCERS[profile_name] = OpenVINOInferencer(path=openvino_path, device="CPU")
            elif torch_path:
                ACTIVE_INFERENCERS[profile_name] = TorchInferencer(path=torch_path, device="cpu")
            else:
                print(f"[ML] ERROR: Missing model files in {base_dir}")
                return None
        except Exception as e:
            print(f"[ML] ERROR: Inferencer crash: {e}")
            return None

    return ACTIVE_INFERENCERS[profile_name]

def run_inference(cv2_frame: np.ndarray, profile_name: str) -> tuple[bool, float, np.ndarray]:
    inferencer = load_inferencer(profile_name)
    if inferencer is None: return False, 0.0, cv2_frame

    try:
        predictions = inferencer.predict(image=cv2_frame)
        raw_score = float(predictions.pred_score)

        # hardcoded threshold for the hackathon (anything over 15 is a defect)
        is_defective = raw_score > 15.0

        # fake a normalized 0-100% confidence score so the UI looks nice
        if is_defective:
            confidence = min(0.50 + (raw_score / 100.0), 0.99)
        else:
            confidence = min(raw_score / 30.0, 0.49)

        heatmap_overlay = predictions.anomaly_map

        # colorize the heatmap mask and blend it with the original frame
        if len(heatmap_overlay.shape) == 2:
            heatmap_overlay = cv2.applyColorMap((heatmap_overlay * 255).astype(np.uint8), cv2.COLORMAP_JET)
            heatmap_overlay = cv2.addWeighted(cv2_frame, 0.5, heatmap_overlay, 0.5, 0)

        return is_defective, float(confidence), heatmap_overlay

    except Exception as e:
        print(f"[ML] WARNING: Frame dropped: {e}")
        return False, 0.0, cv2_frame