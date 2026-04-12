# NeuroSense — Project Structure

## Files

```
neurosense/
├── index.html        ← Main HTML (structure only, links CSS + JS)
├── style.css         ← All styles, variables, animations, components
├── data.js           ← Static data: SYMPTOMS, LIFESTYLE, MEM_SEQS constants
├── scoring.js        ← Risk scoring logic (runs in browser)
├── app.js            ← State, navigation, all step renderers
├── app.py            ← Flask backend — serves files + /api/score endpoint
├── scoring.py        ← Python scoring logic (mirrors scoring.js)
├── requirements.txt  ← Python dependencies
└── README.md         ← This file
```

## How to Run

### Option A — Open directly in browser (no backend needed)
Just open `index.html` in any browser. All scoring runs in JavaScript.

### Option B — Run with Flask backend
```bash
pip install -r requirements.txt
python app.py
```
Then open http://localhost:5000

## API Endpoint

### POST /api/auth
Use the login/signup form to create or sign in a user by name and email. Saved progress is restored from the database.

### POST /api/save
Save the current user's assessment progress to the database.

### POST /api/report
Save the generated report in the database for the current user.

### POST /api/score
Send assessment data, get back a risk score.

**Request body:**
```json
{
  "demo":     { "age": 45, "sex": "Male", "fh": "no", "edu": "degree" },
  "symptoms": { "s1": 2, "s2": 0, "s3": 1, "s4": 0, "s5": 0,
                "s6": 0, "s7": 1, "s8": 2, "s9": 1, "s10": 0 },
  "rts":      [312, 298, 340, 305, 290],
  "memRes":   [true, true, false, true],
  "life":     { "l1": 2, "l2": 3, "l3": 3, "l4": 1, "l5": 2 }
}
```

**Response:**
```json
{
  "score": 28,
  "factors": [
    { "label": "Age factor",       "v": 6,  "max": 25, "c": "#f59e0b" },
    { "label": "Symptom profile",  "v": 14, "max": 30, "c": "#f97316" },
    { "label": "Lifestyle factors","v": 8,  "max": 15, "c": "#60a5fa" }
  ],
  "risk": {
    "label": "Moderate risk",
    "desc":  "Some indicators present..."
  }
}
```
