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

def flush_inferencer(profile_name: str):
    if profile_name in ACTIVE_INFERENCERS:
        del ACTIVE_INFERENCERS[profile_name]

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
        # OpenCV natively uses BGR. Anomalib's PyTorch Dataloader trains on RGB.
        # We MUST swap channels before prediction, otherwise perfect images evaluate as massive anomalies due to inverted colors.
        rgb_frame = cv2.cvtColor(cv2_frame, cv2.COLOR_BGR2RGB)
        
        predictions = inferencer.predict(image=rgb_frame)
        raw_score = float(predictions.pred_score)

        # Print the raw score so the user can see the exact numerical distance of the evaluation
        print(f"[ML-EVAL] Raw Anomaly Score for {profile_name}: {raw_score}")

        # Setting threshold to > 0.95 so 0.9 evaluates to Pass and 1.0 evaluates to Fail.
        is_defective = raw_score > 0.95

        # We will pass the RAW score directly out as confidence so the frontend can visibly see it for threshold calibration
        confidence = raw_score

        heatmap_overlay = predictions.anomaly_map
        
        # force numpy array and squeeze out batch/channel dims if they exist (e.g., 1xHxW to HxW)
        if isinstance(heatmap_overlay, np.ndarray):
            heatmap_overlay = np.squeeze(heatmap_overlay)

        # colorize the heatmap mask and blend it with the original frame
        if len(heatmap_overlay.shape) == 2:
            # Mask is float32 0-1, so normalize to 0-255 uint8
            heatmap_overlay = cv2.applyColorMap((heatmap_overlay * 255).astype(np.uint8), cv2.COLORMAP_JET)
            
            # Ensure cv2_frame shape matches heatmap_overlay (PatchCore interpolates output, might not match original input)
            if heatmap_overlay.shape[:2] != cv2_frame.shape[:2]:
                heatmap_overlay = cv2.resize(heatmap_overlay, (cv2_frame.shape[1], cv2_frame.shape[0]))
                
            heatmap_overlay = cv2.addWeighted(cv2_frame, 0.5, heatmap_overlay, 0.5, 0)
        else:
             # Just in case it's completely malformed, fall back to returning cv2_frame safely
             heatmap_overlay = cv2_frame

        return is_defective, float(confidence), heatmap_overlay

    except Exception as e:
        print(f"[ML] WARNING: Frame dropped: {e}")
        return False, 0.0, cv2_frame