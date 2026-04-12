

import sqlite3
import json
from datetime import datetime
from scoring import compute_risk, risk_info
from pdf_gen import generate_pdf
from flask import Flask, request, jsonify, send_from_directory, send_file

DB_FILE = 'users.db'

app = Flask(__name__, static_folder='.')


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            profile TEXT,
            created_at TEXT,
            last_seen TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            subject TEXT,
            body TEXT,
            created_at TEXT,
            FOREIGN KEY(email) REFERENCES users(email)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            profile_data TEXT,
            score REAL,
            risk_label TEXT,
            created_at TEXT,
            FOREIGN KEY(email) REFERENCES users(email)
        )
    ''')
    conn.commit()
    conn.close()


from werkzeug.exceptions import HTTPException

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return '', 200

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS, PUT, DELETE'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.errorhandler(HTTPException)
def handle_http_exception(e):
    response = e.get_response()
    response.data = json.dumps({
        'error': e.description
    })
    response.content_type = 'application/json'
    return response


@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({'error': str(e)}), 500


init_db()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/api/auth', methods=['POST'])
def auth():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    name = str(data.get('name', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    action = str(data.get('action', '')).strip().lower()

    if not name or not email or not action:
        return jsonify({'error': 'Name, email, and action are required'}), 400
    if '@' not in email or '.' not in email:
        return jsonify({'error': 'Invalid email address'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT name, profile FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    now = datetime.utcnow().isoformat()

    if action == 'signup':
        if row:
            cursor.execute('UPDATE users SET name = ?, last_seen = ? WHERE email = ?', (name, now, email))
        else:
            cursor.execute(
                'INSERT INTO users (email, name, profile, created_at, last_seen) VALUES (?, ?, ?, ?, ?)',
                (email, name, json.dumps({}), now, now)
            )
    elif action == 'login':
        if not row:
            conn.close()
            return jsonify({'error': 'User not found. Please sign up first.'}), 404
        if row['name'] != name:
            cursor.execute('UPDATE users SET name = ?, last_seen = ? WHERE email = ?', (name, now, email))
    elif action == 'auto':
        if row:
            if row['name'] != name:
                cursor.execute('UPDATE users SET name = ?, last_seen = ? WHERE email = ?', (name, now, email))
        else:
            cursor.execute(
                'INSERT INTO users (email, name, profile, created_at, last_seen) VALUES (?, ?, ?, ?, ?)',
                (email, name, json.dumps({}), now, now)
            )
    else:
        conn.close()
        return jsonify({'error': 'Invalid action'}), 400

    conn.commit()
    cursor.execute('SELECT name, profile FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    conn.close()

    profile = json.loads(row['profile']) if row and row['profile'] else {}
    return jsonify({'user': {'name': name, 'email': email}, 'profile': profile})


@app.route('/api/save', methods=['POST'])
def save_profile():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    email = str(data.get('email', '')).strip().lower()
    profile = data.get('profile')
    if not email or profile is None:
        return jsonify({'error': 'Email and profile are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET profile = ?, last_seen = ? WHERE email = ?', (json.dumps(profile), datetime.utcnow().isoformat(), email))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/report', methods=['POST'])
def save_report():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    email = str(data.get('email', '')).strip().lower()
    subject = str(data.get('subject', '')).strip()
    body = str(data.get('body', '')).strip()
    if not email or not subject or not body:
        return jsonify({'error': 'Email, subject, and body are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO reports (email, subject, body, created_at) VALUES (?, ?, ?, ?)',
                   (email, subject, body, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/score', methods=['POST'])
def score():
    data = request.get_json(force=True)

    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    required = ['demo', 'symptoms', 'rts', 'memRes', 'life']
    missing  = [k for k in required if k not in data]
    if missing:
        return jsonify({'error': f'Missing fields: {missing}'}), 400

    try:
        result  = compute_risk(data)
        info    = risk_info(result['score'])
        
        previous_score = None
        previous_date = None
        email = data.get('email', '').strip().lower()
        
        if email:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Fetch previous most recent assessment
            cursor.execute('SELECT score, created_at FROM assessments WHERE email = ? ORDER BY created_at DESC LIMIT 1', (email,))
            row = cursor.fetchone()
            if row:
                previous_score = float(row['score'])
                previous_date = row['created_at']
            
            # Insert new assessment
            cursor.execute(
                'INSERT INTO assessments (email, profile_data, score, risk_label, created_at) VALUES (?, ?, ?, ?, ?)',
                (email, json.dumps(data), result['score'], info['label'], datetime.utcnow().isoformat())
            )
            conn.commit()
            conn.close()

        response_data = {
            'score':   result['score'],
            'factors': result['factors'],
            'risk':    info
        }
        
        if previous_score is not None:
            response_data['previous_score'] = previous_score
            response_data['previous_date'] = previous_date
            response_data['score_change'] = result['score'] - previous_score
            
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download_report', methods=['POST'])
def download_report():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    email = str(data.get('email', '')).strip().lower()
    # Attempt to extract name from user object or default
    user_obj = data.get('user', {})
    name = user_obj.get('name', 'Anonymous')

    try:
        result = compute_risk(data)
        info = risk_info(result['score'])
        result['risk'] = info

        user_info = {'name': name, 'email': email}
        
        # We pass result (score, factors, risk_info), user_info, and raw data
        buffer = generate_pdf(result, user_info, data)

        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'NeuroSense_Report_{datetime.now().strftime("%Y%m%d")}.pdf'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
