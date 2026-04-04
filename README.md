# defeX Edge Server
## Team Bitwise
Team ID - 0014
Problem Statement ID - SME03

## 📝 Description
defeX is a professional, high-performance edge computing application built for real-time industrial inspection and anomaly detection. This system dynamically models functional baseline profiles of components using a machine learning backend and identifies structural defects, surface anomalies, and product drift through advanced PatchCore evaluation mechanics.

This repository contains the finalized, production-ready codebase (merged from `main_final`), encapsulating the core user-interface application, backend API server, and all dedicated machine learning components.

## 📂 Project Structure
```plaintext
.
├── backend/             # FastAPI asynchronous backend application and core API bridge
├── frontend/            # React-based Vite frontend UI with live telemetry components
├── ml_engine/           # Machine Learning logic and dependencies (Anomalib/PyTorch)
│   ├── src/             # Inference and Calibration routines
│   └── requirements.txt # Specific dependencies for the ML engine
├── README.md            # You are here
└── .gitignore           # Global project git ignores
```

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+)
* **Python 3.10+** (or your specific tested version)
* Virtual Environment (recommended)

### Installation
Clone the repository:
```bash
git clone https://github.com/your-username/veritas-q-edge.git
cd Bitwise_ignisia
```

#### Set up the Backend Environment:
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/MacOS:
source venv/bin/activate
```

#### Install Dependencies:
Install the core project backend requirements:
```bash
pip install -r requirements.txt
```

If you are working specifically with the ML Engine or setting up for active inference, ensure the neural network dependencies are strictly met:
```bash
cd ../ml_engine
pip install -r requirements.txt
```

Set up and install the Frontend UI requirements:
```bash
cd ../frontend
npm install
```

## 🛠 Usage
This application operates on a split architecture (Frontend UI and Backend Server).

**To start the Backend Server:**
Ensure your virtual environment is active, then run:
```bash
cd backend
python run.py
# Or launch directly with Uvicorn: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**To start the Frontend Application:**
Open a new terminal window, navigate to the frontend, and run the developer server:
```bash
cd frontend
npm run dev
```

The application will be accessible via browser at `http://localhost:5173`.

### Running an Inspection
1. **Calibration:** Upon opening the frontend, click **Open Calibration Matrix**. You must upload the **ideal, defect-free baseline images** (these are located in your local `Data images` folder) to establish the structural "Golden Reference".
2. **Train the Model:** Click **Train** and wait briefly for the engine to compile the baseline memory bank.
3. **Inspection:** Once calibrated, upload the **defective test images** to the inspection timeline. Click **Run Inspection** to evaluate each image against the ideal baseline and view the generated anomaly heatmaps and yield scores!

## 🤖 ML Engine Note
The `ml_engine` directory is a highly dedicated module handling the project's data science, PatchCore modeling configurations, and OpenVINO runtime requirements. Ensure that any updates to the machine learning stack are rigorously isolated to `ml_engine` and reflected strictly in `ml_engine/requirements.txt` to avoid crippling version or multiprocessing conflicts with the FastAPI main application thread.



## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
