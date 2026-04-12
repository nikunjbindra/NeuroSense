import joblib
import os
import numpy as np

# Load ML model once
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'neurosense_model.pkl')
ML_MODEL = None
if os.path.exists(MODEL_PATH):
    try:
        ML_MODEL = joblib.load(MODEL_PATH)
    except Exception as e:
        print(f"Error loading ML model: {e}")

SYMPTOMS = [
    {'id': 's1',  'w': 3.0,  'cat': 'Memory'},
    {'id': 's2',  'w': 2.5,  'cat': 'Spatial'},
    {'id': 's3',  'w': 2.5,  'cat': 'Language'},
    {'id': 's4',  'w': 1.5,  'cat': 'Physical'},
    {'id': 's5',  'w': 2.0,  'cat': 'Motor'},
    {'id': 's6',  'w': 3.0,  'cat': 'Motor'},
    {'id': 's7',  'w': 1.5,  'cat': 'Mood'},
    {'id': 's8',  'w': 2.0,  'cat': 'Cognitive'},
    {'id': 's9',  'w': 2.0,  'cat': 'Sleep'},
    {'id': 's10', 'w': 2.5,  'cat': 'Motor'},
]

LIFESTYLE_RISK = {
    'l1': [3, 1.5, 0, 0.5],
    'l2': [3, 2,   1, 0  ],
    'l3': [3, 2,   1, 0  ],
    'l4': [2, 1,   0, 0  ],
    'l5': [2, 1, 0.5, 0  ],
}

MEM_SEQS_LEN = 4   


def extract_features(data):
    """Transform raw user input mapping to structured numerical features."""
    demo = data.get('demo', {})
    symptoms = data.get('symptoms', {})
    rts = data.get('rts', [])
    mem_res = data.get('memRes', [])
    life = data.get('life', {})
    
    age = int(demo.get('age', 0) or 0)
    sex_map = {'Male': 0, 'Female': 1, 'Other': 2}
    sex = sex_map.get(demo.get('sex'), 0)
    fh = 1 if demo.get('fh') == 'yes' else 0
    edu_map = {'highschool': 0, 'diploma': 1, 'degree': 2, 'postgrad': 3}
    edu = edu_map.get(demo.get('edu', ''), 0)
    
    sym_cats = {'Memory': 0, 'Spatial': 0, 'Language': 0, 'Physical': 0, 
                'Motor': 0, 'Mood': 0, 'Cognitive': 0, 'Sleep': 0}
                
    for s in SYMPTOMS:
        val = int(symptoms.get(s['id'], 0))
        sym_cats[s['cat']] += val

    rt_avg = sum(rts) / len(rts) if rts else 400.0
    mem_score = sum(1 for r in mem_res if r) if mem_res else 0
    
    l1 = int(life.get('l1', 1))
    l2 = int(life.get('l2', 1))
    l3 = int(life.get('l3', 1))
    l4 = int(life.get('l4', 1))
    l5 = int(life.get('l5', 1))
    
    return [
        age, sex, fh, edu,
        sym_cats['Memory'], sym_cats['Spatial'], sym_cats['Language'], sym_cats['Physical'],
        sym_cats['Motor'], sym_cats['Mood'], sym_cats['Cognitive'], sym_cats['Sleep'],
        rt_avg, mem_score,
        l1, l2, l3, l4, l5
    ]

def compute_risk(data: dict) -> dict:
    """
    Compute neurological risk score from assessment data.

    Parameters
    ----------
    data : dict with keys demo, symptoms, rts, memRes, life

    Returns
    -------
    dict  { score: int (0-100), factors: list }
    """
    score   = 0.0
    factors = []

    demo     = data.get('demo', {})
    symptoms = data.get('symptoms', {})
    rts      = data.get('rts', [])
    mem_res  = data.get('memRes', [])
    life     = data.get('life', {})

    # ── Age ──────────────────────────────────────────────
    age = int(demo.get('age', 0) or 0)
    age_score = (25 if age >= 76 else
                 18 if age >= 66 else
                 12 if age >= 56 else
                  6 if age >= 46 else 0)
    if age_score > 0:
        factors.append({'label': 'Age factor', 'v': age_score, 'max': 25, 'c': '#f59e0b'})
    score += age_score

    if demo.get('fh') == 'yes':
        score += 20
        factors.append({'label': 'Family history', 'v': 20, 'max': 20, 'c': '#ef4444'})

    edu = demo.get('edu', '')
    if   edu == 'postgrad': score -= 3
    elif edu == 'degree':   score -= 1.5

    s_max  = sum(s['w'] * 3 for s in SYMPTOMS)
    s_raw  = sum((symptoms.get(s['id'], 0)) * s['w'] for s in SYMPTOMS)
    s_score = round((s_raw / s_max) * 30) if s_max else 0
    if s_score > 0:
        factors.append({'label': 'Symptom profile', 'v': s_score, 'max': 30, 'c': '#f97316'})
    score += s_score

    if rts:
        avg  = sum(rts) / len(rts)
        base = 280 if age < 40 else 320 if age < 55 else 380 if age < 70 else 440
        rt_s = (12 if avg > base + 200 else
                 8 if avg > base + 100 else
                 4 if avg > base       else 0)
        if rt_s > 0:
            factors.append({'label': 'Reaction time', 'v': rt_s, 'max': 12, 'c': '#f59e0b'})
        score += rt_s

    if mem_res:
        correct = sum(1 for r in mem_res if r)
        m_s = round(((MEM_SEQS_LEN - correct) / MEM_SEQS_LEN) * 10)
        if m_s > 0:
            factors.append({'label': 'Memory performance', 'v': m_s, 'max': 10, 'c': '#a78bfa'})
        score += m_s

    l_raw = sum(
        LIFESTYLE_RISK[qid][int(opt_idx)]
        for qid, opt_idx in life.items()
        if qid in LIFESTYLE_RISK
    )
    l_s = round(min(l_raw * 1.5, 15))
    if l_s > 0:
        factors.append({'label': 'Lifestyle factors', 'v': l_s, 'max': 15, 'c': '#60a5fa'})
    score += l_s

    # --- AI HYBRID OVERRIDE ---
    if ML_MODEL is not None:
        features = extract_features(data)
        score = float(ML_MODEL.predict([features])[0])
    # --------------------------

    return {
        'score':   max(0, min(100, round(score))),
        'factors': factors
    }


def risk_info(score: int) -> dict:
    """Return risk label, colours, and description for a given score."""
    if score < 25:
        return {
            'label': 'Low risk',
            'c': '#22c55e', 'bg': 'rgba(34,197,94,.1)', 'bc': 'rgba(34,197,94,.3)',
            'desc': 'No significant neurological risk indicators detected. '
                    'Continue with healthy lifestyle habits and regular check-ups.'
        }
    if score < 50:
        return {
            'label': 'Moderate risk',
            'c': '#f59e0b', 'bg': 'rgba(245,158,11,.1)', 'bc': 'rgba(245,158,11,.3)',
            'desc': 'Some indicators present. Consider scheduling a routine check-up '
                    'with your physician to discuss these findings.'
        }
    if score < 70:
        return {
            'label': 'Elevated risk',
            'c': '#f97316', 'bg': 'rgba(249,115,22,.1)', 'bc': 'rgba(249,115,22,.3)',
            'desc': 'Multiple indicators detected. A consultation with a neurologist '
                    'is strongly recommended in the near future.'
        }
    return {
        'label': 'High risk',
        'c': '#ef4444', 'bg': 'rgba(239,68,68,.1)', 'bc': 'rgba(239,68,68,.3)',
        'desc': 'Significant indicators present. Please consult a qualified neurologist '
                'as soon as possible for a proper evaluation.'
    }
