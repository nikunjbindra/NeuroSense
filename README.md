# 🧠 NeuroSense — Neurological Risk Assessment & Cognitive Screening Platform

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

> **NeuroSense** is a comprehensive, data-driven neurological screening and risk prediction system. By synthesizing demographic history, lifestyle habits, multi-domain symptom profiles, and real-time interactive cognitive tests, NeuroSense delivers early risk stratification and automated clinical reports to facilitate timely medical intervention.

---

## 🌟 Key Features

### 1. 📋 Multi-Domain Symptom & Lifestyle Profiling
- **Clinical Symptom Matrix**: Evaluates 10 weighted neurological indicators covering Memory, Spatial Orientation, Language, Motor Control, Mood Stability, and Sleep Architecture.
- **Lifestyle Markers**: Analyzes physical activity, sleep hygiene, diet quality, stress exposure, and cognitive engagement.
- **Demographic Stratification**: Accounts for age-adjusted thresholds, biological sex, education level, and familial neurological history.

### 2. ⚡ Real-Time Interactive Cognitive Tests
- **Visual Reaction Time (RT) Engine**: Millisecond-precision stimulus-response test measuring neuromuscular processing latency across multiple randomized trials.
- **Working Memory Sequence Test**: Progressive visual sequence recall test assessing immediate working memory and spatial attention span.

### 3. 🤖 Hybrid Machine Learning & Clinical Scoring Engine
- **Random Forest Regressor**: Trained on multivariate cognitive and demographic patterns to estimate continuous neurological risk scores (0–100).
- **Rule-Based Heuristic Fallback**: Deterministic clinical rule baseline ensuring full offline scoring capability even without ML weights loaded.
- **Categorical Risk Tiers**: Categorizes findings into Low Risk (<25), Moderate Risk (25–49), Elevated Risk (50–69), and High Risk (70–100).

### 4. 📄 Automated PDF Clinical Summary
- **Vector-rendered PDF Reports**: Generates downloadable clinical evaluation summaries using ReportLab, detailing risk factors, cognitive latencies, and doctor consultation guidance.

### 5. 💾 User Authentication & Assessment History
- **SQLite Database**: Lightweight local user state management, saving profiles, progress milestones, and historical assessment results.

---

## 🏗️ Architecture & Project Structure

```
Neurology Prediction - DTI/
├── index.html                   # Core application markup & UI container
├── style.css                    # Modern dark-mode glassmorphic design system
├── app.js                       # Frontend orchestration, step transitions, test drivers
├── data.js                      # Static symptoms, questions, and cognitive test sequences
├── scoring.js                   # Client-side JavaScript risk calculation engine
├── app.py                       # Flask REST backend & static web server
├── scoring.py                   # Python hybrid scoring logic (ML + heuristic)
├── pdf_gen.py                   # ReportLab PDF report generation engine
├── train_model.py               # Model training script for Random Forest Regressor
├── neurosense_model.pkl         # Serialized machine learning model weights
├── requirements.txt             # Python dependencies
├── .env.example                 # Sample environment variables
├── .gitignore                   # Git exclusion rules
├── LICENSE                      # MIT Open-Source License
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start Guide

### Option A — Instant Browser Execution (Zero Dependencies)
You can run NeuroSense without installing Python or setting up a server:
1. Clone or download the repository.
2. Open `index.html` in any modern web browser (Google Chrome, Firefox, Edge, Safari).
3. The assessment and client-side scoring logic will run entirely in your browser via `scoring.js`.

---

### Option B — Full-Stack Server Mode (Flask + ML + PDF Generation)

#### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/NeuroSense.git
cd NeuroSense
```

#### 2. Create and Activate a Virtual Environment
- **Windows (PowerShell)**:
  ```powershell
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  ```
- **macOS / Linux**:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Run the Application
```bash
python app.py
```
After starting the server, open your browser and navigate to:
```
http://localhost:5000
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the web application interface (`index.html`) |
| `POST` | `/api/auth` | User authentication (Sign up / Log in / Auto session restoration) |
| `POST` | `/api/save` | Persists user assessment progress state to SQLite |
| `POST` | `/api/score` | Calculates hybrid AI risk score from demographic and cognitive test data |
| `POST` | `/api/report` | Saves generated assessment report to database |
| `POST` | `/api/pdf` | Generates and downloads a formatted clinical PDF report |

### Example Request (`POST /api/score`):
```json
{
  "demo": {
    "age": 52,
    "sex": "Female",
    "fh": "yes",
    "edu": "degree"
  },
  "symptoms": {
    "s1": 2, "s2": 1, "s3": 0, "s4": 0, "s5": 1,
    "s6": 0, "s7": 1, "s8": 2, "s9": 1, "s10": 0
  },
  "rts": [312, 298, 340, 305, 290],
  "memRes": [true, true, false, true],
  "life": {
    "l1": 2, "l2": 3, "l3": 1, "l4": 2, "l5": 2
  }
}
```

### Example Response:
```json
{
  "score": 42,
  "factors": [
    { "label": "Age factor", "v": 8, "max": 25, "c": "#f59e0b" },
    { "label": "Symptom profile", "v": 16, "max": 30, "c": "#f97316" },
    { "label": "Reaction time", "v": 6, "max": 12, "c": "#f59e0b" },
    { "label": "Lifestyle factors", "v": 9, "max": 15, "c": "#60a5fa" }
  ],
  "risk": {
    "label": "Moderate risk",
    "desc": "Some indicators present. Consider scheduling a routine check-up with your physician to discuss these findings."
  }
}
```

---

## 🔬 Model Retraining

If you wish to retrain or fine-tune the Random Forest model:
```bash
python train_model.py
```
This script:
1. Synthesizes demographic, symptom, and cognitive test distributions.
2. Extracts numerical feature vectors matching the inference pipeline.
3. Fits a `RandomForestRegressor` with cross-validation.
4. Serializes the newly trained model weights to `neurosense_model.pkl`.

---

## 🛡️ Medical Disclaimer
> **Important**: NeuroSense is an educational and early screening demonstration tool. It does **not** provide official medical diagnoses. Anyone experiencing neurological symptoms or cognitive decline should consult a certified healthcare professional or neurologist.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
