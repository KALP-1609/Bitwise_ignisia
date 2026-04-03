import os
import cv2
import shutil
import numpy as np
from anomalib.engine import Engine
from anomalib.models import Patchcore
from anomalib.data import Folder

# fallback for older anomalib export enums
try:
    from anomalib.deploy import ExportType
    EXPORT_MODE = ExportType.TORCH
except ImportError:
    EXPORT_MODE = "torch"

def calibrate_model(image_list: list[np.ndarray], profile_name: str) -> bool:
    print(f"[ML] Starting calibration for profile: {profile_name}")

    # prep temp folder structure for anomalib's dataloader
    base_dir = os.path.abspath(f"./data/temp_{profile_name}")
    normal_dir = os.path.join(base_dir, "normal")
    abnormal_dir = os.path.join(base_dir, "abnormal")

    if os.path.exists(base_dir): shutil.rmtree(base_dir)
    os.makedirs(normal_dir, exist_ok=True)
    os.makedirs(abnormal_dir, exist_ok=True)

    try:
        # dump clean images to disk
        for idx, img in enumerate(image_list):
            cv2.imwrite(os.path.join(normal_dir, f"sample_{idx}.jpg"), img)

        # add 4 dummy defect images to bypass lightning's 50/50 validation split bug
        for i in range(4):
            cv2.imwrite(os.path.join(abnormal_dir, f"dummy_defect_{i}.jpg"), image_list[0])
    except Exception as e:
        print(f"[ML] ERROR: Failed to write calibration images: {e}")
        return False

    try:
        datamodule = Folder(
            name=profile_name,
            root=base_dir,
            normal_dir="normal",
            abnormal_dir="abnormal",
            train_batch_size=2,
            eval_batch_size=2
        )
    except Exception as e:
        print(f"[ML] ERROR: Failed to init DataModule: {e}")
        return False

    # lightweight backbone for fast edge inference
    model = Patchcore(backbone="wide_resnet50_2", pre_trained=True, coreset_sampling_ratio=0.1)

    # aggressive flags to kill progress bars, loggers, and validation checks
    engine = Engine(
        max_epochs=1,
        default_root_dir=os.path.abspath(f"../backend/app/ml_bridge/memory_banks/{profile_name}"),
        limit_val_batches=0,
        limit_test_batches=0,
        num_sanity_val_steps=0,
        log_every_n_steps=1,
        enable_progress_bar=False,
        logger=False
    )

    try:
        engine.fit(model=model, datamodule=datamodule)
        print(f"[ML] Memory Bank trained for {profile_name}")

        # compile to torchscript for faster runtime
        print("[ML] Exporting model to TorchScript...")
        try:
            engine.export(model=model, export_type=EXPORT_MODE, datamodule=datamodule)
        except Exception:
            engine.export(model=model, export_type=EXPORT_MODE)

        print("[ML] Export complete.")
        return True
    except Exception as e:
        import traceback
        print("[ML] ERROR: Calibration failed with traceback:")
        traceback.print_exc()
        return False