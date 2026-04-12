import json
import random
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib

# Import existing deterministic logic to label our synthetic data
from scoring import compute_risk, SYMPTOMS

# Features definition
def extract_features(data):
    """Transform raw user input mapping to structured numerical features."""
    demo = data.get('demo', {})
    symptoms = data.get('symptoms', {})
    rts = data.get('rts', [])
    mem_res = data.get('memRes', [])
    life = data.get('life', {})
    
    # 1. Demographics
    age = int(demo.get('age', 0) or 0)
    sex_map = {'Male': 0, 'Female': 1, 'Other': 2}
    sex = sex_map.get(demo.get('sex'), 0)
    fh = 1 if demo.get('fh') == 'yes' else 0
    edu_map = {'highschool': 0, 'diploma': 1, 'degree': 2, 'postgrad': 3}
    edu = edu_map.get(demo.get('edu', ''), 0)
    
    # 2. Symptoms by Category 
    sym_cats = {'Memory': 0, 'Spatial': 0, 'Language': 0, 'Physical': 0, 
                'Motor': 0, 'Mood': 0, 'Cognitive': 0, 'Sleep': 0}
                
    for s in SYMPTOMS:
        val = int(symptoms.get(s['id'], 0))
        sym_cats[s['cat']] += val

    # 3. Cognitive Tests
    rt_avg = sum(rts) / len(rts) if rts else 400.0
    mem_score = sum(1 for r in mem_res if r) if mem_res else 0
    
    # 4. Lifestyle
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

def generate_synthetic_data(num_samples=5000):
    print(f"Generating {num_samples} synthetic profiles...")
    
    X_raw = []
    y = []
    
    for _ in range(num_samples):
        # Generate random demo
        age = random.randint(18, 95)
        sex = random.choice(['Male', 'Female', 'Other'])
        fh = random.choice(['yes', 'no'])
        edu = random.choice(['highschool', 'diploma', 'degree', 'postgrad'])
        
        # Generate random symptoms (0 to 3) based on some risk skew to make it semi-realistic
        risk_profile = random.random()
        symptom_max = 3 if risk_profile > 0.8 else 2 if risk_profile > 0.5 else 1
        symptoms = {f"s{i}": random.randint(0, symptom_max) for i in range(1, 11)}
        
        # Cognitive tests
        rt_base = 250 + (age - 18) * 2 + random.randint(0, 100)
        # Higher risk -> slower reaction
        if risk_profile > 0.8: rt_base += 150
        rts = [rt_base + random.randint(-40, 40) for _ in range(5)]
        
        memRes = [random.random() > (0.2 + risk_profile*0.5) for _ in range(4)]
        
        # Lifestyle
        life = {f"l{i}": random.randint(0, 3) for i in range(1, 6)}
        
        payload = {
            'demo': {'age': age, 'sex': sex, 'fh': fh, 'edu': edu},
            'symptoms': symptoms,
            'rts': rts,
            'memRes': memRes,
            'life': life
        }
        
        # Map payload to features
        features = extract_features(payload)
        
        # Use existing rule-based scoring as ground truth label (hybrid approach)
        score_res = compute_risk(payload)
        
        # Add some slight noise to the target variable to force ML model to generalize rather than just memorize the formula
        target = max(0, min(100, score_res['score'] + random.uniform(-3, 3)))
        
        X_raw.append(features)
        y.append(target)
        
    return np.array(X_raw), np.array(y)
def load_real_data(csv_path="archive/alzheimers_disease_data.csv"):
    import os
    abs_path = os.path.join(os.path.dirname(__file__), csv_path)
    if not os.path.exists(abs_path):
        return None, None
        
    print(f"Loading real clinical data from {abs_path}...")
    df = pd.read_csv(abs_path)
    
    X_raw = []
    y = []
    
    for _, row in df.iterrows():
        # 1. Demographics
        age = int(row['Age'])
        sex = int(row['Gender']) # 0=Male, 1=Female
        fh = int(row['FamilyHistoryAlzheimers'])
        edu = int(row['EducationLevel'])
        
        # 2. Symptoms by Category mapped to Discrete severity
        sym_memory = (row['Forgetfulness'] + row['MemoryComplaints'])
        sym_spatial = row['Disorientation']
        sym_language = 0 
        sym_physical = row['ADL'] / 3.3
        sym_motor = 0 
        sym_mood = (row['Depression'] + row['PersonalityChanges'])
        sym_cognitive = (row['Confusion'] + row['DifficultyCompletingTasks'])
        sym_sleep = (10 - row['SleepQuality']) / 3.3 
        
        # 3. Cognitive Tests
        mem_score = (row['MMSE'] / 30.0) * 4.0 
        rt_avg = 200 + row['FunctionalAssessment'] * 40
        
        # 4. Lifestyle mapping (0-3 range)
        life_sleep = 3 - (row['SleepQuality'] / 3.3)
        life_exercise = 3 - (row['PhysicalActivity'] / 3.3)
        life_smoke = row['Smoking'] * 3.0
        life_diet = 3 - (row['DietQuality'] / 3.3)
        life_cognitive = row['AlcoholConsumption'] / 6.6 
        
        features = [
            age, sex, fh, edu,
            sym_memory, sym_spatial, sym_language, sym_physical,
            sym_motor, sym_mood, sym_cognitive, sym_sleep,
            rt_avg, mem_score,
            life_sleep, life_exercise, life_smoke, life_diet, life_cognitive
        ]
        
        target = (row['Diagnosis'] * 60) + ((30 - row['MMSE']) / 30.0 * 40)
        target = max(0, min(100, target))
        
        X_raw.append(features)
        y.append(target)
        
    return np.array(X_raw), np.array(y)

if __name__ == '__main__':
    X, y = load_real_data()
    if X is None:
        print("Real dataset not found. Falling back to synthetic.")
        X, y = generate_synthetic_data(5000)
    
    # Feature columns corresponding to extract_features
    columns = [
        'age', 'sex', 'fh', 'edu',
        'sym_memory', 'sym_spatial', 'sym_language', 'sym_physical',
        'sym_motor', 'sym_mood', 'sym_cognitive', 'sym_sleep',
        'rt_avg', 'mem_score',
        'life_sleep', 'life_exercise', 'life_smoke', 'life_diet', 'life_cognitive'
    ]
    
    df_X = pd.DataFrame(X, columns=columns)
    
    print("Splitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(df_X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Regressor...")
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    
    print("Evaluating Model...")
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f"Mean Squared Error: {mse:.2f}")
    print(f"R2 Score: {r2:.4f}")
    
    model_path = 'neurosense_model.pkl'
    joblib.dump(model, model_path)
    print(f"Model saved successfully to {model_path}.")
