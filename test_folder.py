import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from anomalib.data import Folder

print("Testing Folder init")
try:
    datamodule = Folder(
        name="test",
        root="dummy",
        normal_dir="normal",
        abnormal_dir="abnormal",
        train_batch_size=2,
        eval_batch_size=2,
        num_workers=0
    )
    print("Success with num_workers=0")
except Exception as e:
    print("Exception with num_workers=0:", type(e), e)

try:
    datamodule = Folder(
        name="test",
        root="dummy",
        normal_dir="normal",
        abnormal_dir="abnormal",
        train_batch_size=2,
        eval_batch_size=2
    )
    print("Success without num_workers")
except Exception as e:
    print("Exception without num_workers:", type(e), e)
