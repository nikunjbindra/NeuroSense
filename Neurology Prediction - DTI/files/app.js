const STORAGE_KEY = 'neurosense-pro-state';
const THEME_KEY = 'neurosense-pro-theme';

let state = loadState() || {
  step: 0,
  user: { name: '', email: '' },
  demo: { age: '', sex: '', fh: null, edu: '' },
  symptoms: {},
  rts: [],
  memRes: [],
  life: {}
};
if (!state.user) state.user = { name: '', email: '' };
if (!('email' in state.user)) state.user.email = '';

let rtPhase = 'intro', rtTimes = [], rtTrial = 0, rtTimeout = null, rtStart = null;
let memPhase = 'intro', memSeqIdx = 0, memResults = [], memDigitIdx = -1, memTimeout = null;

function qs(id) { return document.getElementById(id); }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function clearSavedState() { localStorage.removeItem(STORAGE_KEY); }
function cleanupTimers() { clearTimeout(rtTimeout); clearTimeout(memTimeout); }
function resetTransientState() {
  cleanupTimers();
  rtPhase = 'intro'; rtTimes = []; rtTrial = 0; rtStart = null;
  memPhase = 'intro'; memSeqIdx = 0; memResults = []; memDigitIdx = -1;
}
function restartAll() {
  const user = state.user || { name: '', email: '' };
  state = { step: 0, user, demo: { age: '', sex: '', fh: null, edu: '' }, symptoms: {}, rts: [], memRes: [], life: {} };
  resetTransientState();
  clearSavedState();
  saveState();
  nav(0);
}

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
  const btn = qs('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

function capitalizeName(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

function getMailtoHref(to, subject, body) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

const API_BASE = window.location.origin.includes('5000') ? '' : 'http://127.0.0.1:5000';

async function fetchJson(url, options) {
  const fullUrl = url.startsWith('/') ? API_BASE + url : url;
  const res = await fetch(fullUrl, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(`Invalid JSON response from ${fullUrl}: ${text.substring(0, 200)}`);
    }
  }
  if (!res.ok) {
    const message = data && data.error ? data.error : `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data;
}

async function authUser(action, name, email) {
  try {
    const data = await fetchJson('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, name, email })
    });
    return data;
  } catch (err) {
    console.warn('Auth error', err);
    throw err;
  }
}

async function saveProfileToServer() {
  if (!state.user.email || !isValidEmail(state.user.email)) return;
  const profile = {
    demo: state.demo,
    symptoms: state.symptoms,
    rts: state.rts,
    memRes: state.memRes,
    life: state.life,
    step: state.step
  };
  try {
    await fetchJson('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.user.email, profile })
    });
  } catch (err) {
    console.warn('Failed to save profile to server', err);
  }
}

async function saveReportToServer(subject, body) {
  if (!state.user.email || !isValidEmail(state.user.email)) return;
  try {
    await fetchJson('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.user.email, subject, body })
    });
  } catch (err) {
    console.warn('Failed to save report to server', err);
  }
}

function mergeSavedState(saved) {
  if (!saved) return;
  state.demo = saved.demo || state.demo;
  state.symptoms = saved.symptoms || state.symptoms;
  state.rts = saved.rts || state.rts;
  state.memRes = saved.memRes || state.memRes;
  state.life = saved.life || state.life;
  state.step = saved.step || 1;
  saveState();
}

function scoreToPercent(score) { return Math.max(0, Math.min(100, score)); }
function assessmentCompletion() {
  const total = 4 + SYMPTOMS.length + LIFESTYLE.length + 2;
  let done = 0;
  if (state.demo.age) done++; if (state.demo.sex) done++; if (state.demo.fh) done++; if (state.demo.edu) done++;
  done += Object.keys(state.symptoms).length;
  done += Object.keys(state.life).length;
  if (state.rts.length) done++; if (state.memRes.length) done++;
  return Math.round((done / total) * 100);
}

function nav(step) {
  cleanupTimers();
  state.step = step;
  saveState();
  const hdr = qs('hdr');
  const dots = qs('prog-dots');

  if (step > 0 && step < 6) {
    hdr.style.display = 'flex';
    let d = '';
    for (let i = 1; i <= 5; i++) {
      const active = i === step, done = i < step;
      d += `<div style="height:6px;border-radius:999px;width:${active ? 34 : 12}px;background:${done ? 'rgba(124,111,207,.42)' : active ? '#7c6fcf' : 'var(--b)'};transition:all .28s"></div>`;
    }
    d += `<span class="mono" style="margin-left:10px;font-size:11px;color:var(--t3)">${step}/5</span>`;
    dots.innerHTML = d;
  } else {
    hdr.style.display = 'none';
  }

  const main = qs('main');
  main.style.alignItems = step === 0 ? 'stretch' : 'flex-start';
  const renders = [renderAuth, renderDemo, renderSymptoms, renderReaction, renderMemory, renderLifestyle, renderResults];
  main.innerHTML = '';
  renders[step]();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  bindThemeToggle();
  if (state.user.email && isValidEmail(state.user.email)) {
    saveProfileToServer();
  }
}

function bindThemeToggle() {
  const btn = qs('themeToggle');
  if (btn) btn.onclick = () => applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
}

function renderAuth() {
  const m = qs('main');
  const completion = assessmentCompletion();
  const userName = capitalizeName(state.user.name);
  const userEmail = state.user.email || '';
  
  m.innerHTML = `
  <div class="landing-center fade-up" style="max-width: 1200px; margin: 0 auto;">
    <div class="badge" style="margin-bottom: 30px; border-color: rgba(124,111,207,0.15);">
      <span style="width:6px;height:6px;border-radius:50%;background:#7c6fcf"></span> 
      MULTIMODAL AI SCREENING TOOL
    </div>

    <h1 class="hero-title">
      Early Neurological <br/>
      <span class="hero-gradient">Risk Assessment</span>
    </h1>

    <p class="hero-sub">
      A research prototype combining symptom analysis, cognitive <br/> 
      testing, and lifestyle factors to estimate neurological risk.
    </p>

    <div class="pill-row d2">
      <div class="pill">• Symptom questionnaire</div>
      <div class="pill">• Reaction time test</div>
      <div class="pill">• Digit span memory</div>
    </div>
    <div class="pill-row d3" style="margin-top: 10px;">
      <div class="pill">• Lifestyle analysis</div>
      <div class="pill">• AI risk report</div>
    </div>

    <div id="landingActions" class="d4" style="margin-top: 40px; display: flex; flex-direction: column; align-items: center;">
      <button class="btn btn-p" id="beginBtn" style="padding: 18px 40px; font-size: 18px; border-radius: 18px;">
        ${state.step > 0 ? 'Resume Assessment →' : 'Begin Screening →'}
      </button>
      <div class="small" style="margin-top: 16px; opacity: 0.6;">
        For educational and research purposes only. Not a medical diagnosis tool.
      </div>
    </div>

    <div id="authSection" class="auth-container">
      <div style="background: var(--surface); border: 1px solid var(--b); padding: 30px; border-radius: 20px; box-shadow: var(--shadow-md);">
        <div class="small" style="margin-bottom:14px;letter-spacing:2px;text-transform:uppercase;color:var(--teal)">
          ${userName ? `Welcome back, ${userName}` : 'Login or sign up to begin'}
        </div>
        <div style="display:grid;gap:14px;">
          <input id="userName" class="ifield" type="text" placeholder="Your name" value="${state.user.name}" />
          <input id="userEmail" class="ifield" type="email" placeholder="Your email" value="${userEmail}" />
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn btn-p" id="loginBtn" disabled>Login</button>
            <button class="btn btn-s" id="signupBtn" disabled>Sign up</button>
          </div>
          <button class="btn btn-p" id="startBtn" disabled>Continue →</button>
          <div id="authMessage" class="small" style="line-height:1.6; color: var(--t3);">${userEmail ? 'A valid email is required to save your results.' : 'Please enter a valid email address.'}</div>
        </div>
      </div>
    </div>

    <div class="feature-grid d4" id="featureGrid">
      <div class="feature-card pink">
        <span class="f-icon">🧠</span>
        <div class="f-title">Cognitive Tests</div>
        <div class="f-text">Reaction time & digit span evaluation</div>
      </div>
      <div class="feature-card orange">
        <span class="f-icon">📋</span>
        <div class="f-title">Symptom Analysis</div>
        <div class="f-text">10-factor neurological symptom scoring</div>
      </div>
      <div class="feature-card blue">
        <span class="f-icon">🔍</span>
        <div class="f-title">Explainable AI</div>
        <div class="f-text">See exactly what drove your risk score</div>
      </div>
      <div class="feature-card green">
        <span class="f-icon">🌿</span>
        <div class="f-title">Lifestyle Factors</div>
        <div class="f-text">Sleep, exercise & diet impact analysis</div>
      </div>
    </div>

    <div style="margin-top:50px; width: 100%; max-width: 600px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap; margin-bottom: 8px;">
        <div class="small">Assessment completion</div>
        <div class="mono small">${completion}%</div>
      </div>
      <div class="progress-shell"><div class="progress-bar" style="width:${completion}%"></div></div>
    </div>
  </div>`;

  const beginBtn = qs('beginBtn');
  const authSection = qs('authSection');
  const landingActions = qs('landingActions');
  const featureGrid = qs('featureGrid');

  if (beginBtn) {
    beginBtn.onclick = () => {
      authSection.classList.add('visible');
      landingActions.style.display = 'none';
      featureGrid.style.display = 'none';
    };
  }

  const nameInput = qs('userName');
  const emailInput = qs('userEmail');
  const loginBtn = qs('loginBtn');
  const signupBtn = qs('signupBtn');
  const startBtn = qs('startBtn');
  const authMessage = qs('authMessage');

  const validateAuth = () => {
    const nameValid = nameInput && nameInput.value.trim().length > 0;
    const emailValid = emailInput && isValidEmail(emailInput.value);
    const valid = nameValid && emailValid;
    if (loginBtn) loginBtn.disabled = !valid;
    if (signupBtn) signupBtn.disabled = !valid;
    if (startBtn) startBtn.disabled = !valid;
    if (authMessage) authMessage.textContent = emailValid ? 'A valid email is required to save your results.' : 'Please enter a valid email address.';
  };

  if (nameInput) {
    nameInput.oninput = e => {
      state.user.name = e.target.value;
      saveState();
      validateAuth();
    };
  }
  if (emailInput) {
    emailInput.oninput = e => {
      state.user.email = e.target.value.trim().toLowerCase();
      saveState();
      validateAuth();
    };
  }

  validateAuth();

  const authAction = async (type) => {
    if (!nameInput || !emailInput) return;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    if (!name || !isValidEmail(email)) return;
    try {
      const result = await authUser(type, name, email);
      state.user.name = result.user.name;
      state.user.email = result.user.email;
      saveState();
      mergeSavedState(result.profile || {});
      await saveProfileToServer();
      nav(state.step > 0 ? state.step : 1);
    } catch (err) {
      const msg = err.message || 'Auth failed';
      if (authMessage) authMessage.textContent = msg;
    }
  };

  if (loginBtn) loginBtn.onclick = () => authAction('login');
  if (signupBtn) signupBtn.onclick = () => authAction('signup');
  if (startBtn) startBtn.onclick = () => authAction('auto');
}

function renderDemo() {
  const m = qs('main');
  const userName = capitalizeName(state.user.name) || 'there';
  m.innerHTML = `
  <div class="page fade-up" style="max-width:620px">
    <div class="step-hdr">
      <div class="step-tag">Step 1 of 5 — Profile</div>
      <h2 class="step-title">Personal Information</h2>
      <p class="step-sub">${userName}, these inputs help calibrate the screening model and age-adjust cognitive expectations.</p>
    </div>

    <div class="card glass stack">
      <div>
        <label class="small" style="display:block;margin-bottom:8px">Age</label>
        <input class="ifield" id="age" type="number" min="18" max="100" placeholder="Enter your age" value="${state.demo.age}" style="max-width:220px">
      </div>

      <div>
        <label class="small" style="display:block;margin-bottom:10px">Biological sex</label>
        <div id="sex-group" class="grid-3">
          ${['Male','Female','Other'].map(v => selectableCard('sex', v, state.demo.sex === v)).join('')}
        </div>
      </div>

      <div>
        <label class="small" style="display:block;margin-bottom:10px">Family history of neurological disease</label>
        <div id="fh-group" class="grid-2">
          ${[['yes','Yes'],['no','No / Unknown']].map(([v,l]) => selectableCard('fh', l, state.demo.fh === v, v)).join('')}
        </div>
      </div>

      <div>
        <label class="small" style="display:block;margin-bottom:10px">Highest education level</label>
        <div id="edu-group" class="grid-2">
          ${[['highschool','High school'],['diploma','Diploma / Vocational'],['degree',"Bachelor's degree"],['postgrad','Postgraduate+']].map(([v,l]) => selectableCard('edu', l, state.demo.edu === v, v)).join('')}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="min-width:180px;flex:1">
          <div class="small" style="margin-bottom:8px">Section completion</div>
          <div class="progress-shell"><div class="progress-bar" style="width:${getProfileCompletion()}%"></div></div>
        </div>
        <button class="btn btn-p" id="nextBtn" disabled>Continue →</button>
      </div>
    </div>
  </div>`;

  const validate = () => {
    const a = qs('age').value;
    const ok = a && +a >= 18 && +a <= 100 && state.demo.sex && state.demo.fh && state.demo.edu;
    qs('nextBtn').disabled = !ok;
  };

  qs('age').oninput = e => { state.demo.age = e.target.value; saveState(); validate(); };
  attachOptionHandlers('sex-group', val => { state.demo.sex = val; renderDemo(); });
  attachOptionHandlers('fh-group', val => { state.demo.fh = val; renderDemo(); });
  attachOptionHandlers('edu-group', val => { state.demo.edu = val; renderDemo(); });
  qs('nextBtn').onclick = () => nav(2);
  validate();
}

function renderSymptoms() {
  const answered = Object.keys(state.symptoms).length;
  const pct = Math.round((answered / SYMPTOMS.length) * 100);
  const m = qs('main');
  const userName = capitalizeName(state.user.name) || 'there';
  m.innerHTML = `
  <div class="page fade-up">
    <div class="step-hdr">
      <div class="step-tag">Step 2 of 5 — Symptoms</div>
      <h2 class="step-title">Symptom Assessment</h2>
      <p class="step-sub">${userName}, rate each symptom based on the last 6 months. This improves the quality of the risk profile.</p>
    </div>

    <div class="card glass" style="margin-bottom:14px;padding:18px 20px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <div class="small">Answered ${answered} of ${SYMPTOMS.length}</div>
        <div class="mono small">${pct}% complete</div>
      </div>
      <div class="progress-shell"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>

    <div class="stack">
      ${SYMPTOMS.map((s, i) => `
        <div class="card glass panel-hover" style="padding:16px 18px">
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;flex-wrap:wrap">
            <span class="mono" style="font-size:10px;color:var(--teal);margin-top:3px;letter-spacing:1px">Q${i + 1}</span>
            <span style="font-size:14px;font-weight:600;flex:1;color:var(--t1)">${s.text}</span>
            <span style="font-size:11px;color:var(--t3);background:var(--s2);padding:4px 10px;border-radius:999px;border:1px solid var(--b)">${s.cat}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${['Never','Sometimes','Often','Always'].map((opt, j) => `<div class="chip ${state.symptoms[s.id] === j ? `c${j}` : ''}" data-sid="${s.id}" data-val="${j}">${opt}</div>`).join('')}
          </div>
        </div>`).join('')}
    </div>

    <div class="nav">
      <button class="btn btn-s" id="backBtn">← Back</button>
      <button class="btn btn-p" id="nextBtn" ${answered < SYMPTOMS.length ? 'disabled' : ''}>Continue →</button>
    </div>
  </div>`;

  document.querySelectorAll('.chip').forEach(el => {
    el.onclick = () => {
      state.symptoms[el.dataset.sid] = parseInt(el.dataset.val, 10);
      saveState();
      renderSymptoms();
    };
  });
  qs('backBtn').onclick = () => nav(1);
  qs('nextBtn').onclick = () => nav(3);
}

function renderReaction() {
  const m = qs('main');
  const userName = capitalizeName(state.user.name) || 'there';
  if (rtPhase === 'intro') {
    m.innerHTML = `
    <div class="page fade-up" style="max-width:600px">
      <div class="step-hdr">
        <div class="step-tag">Step 3 of 5 — Reaction Test</div>
        <h2 class="step-title">Reaction Speed</h2>
        <p class="step-sub">${userName}, click the circle as soon as it turns green. Faster reactions usually suggest better processing speed.</p>
      </div>
      <div class="card glass center">
        <div class="metric-ring" style="--pct:25;--accent:#e07b7b;margin:0 auto 18px"><div class="mono" style="font-size:14px;color:var(--t2)">WAIT</div></div>
        <div style="font-size:14px;color:var(--t3);line-height:1.7;max-width:420px;margin:0 auto">There will be ${RT_TRIALS} trials. Clicking too early resets the current trial.</div>
        <div class="nav" style="justify-content:center;margin-top:24px">
          <button class="btn btn-s" id="backBtn">← Back</button>
          <button class="btn btn-p" id="startBtn">Start test</button>
        </div>
      </div>
    </div>`;
    qs('backBtn').onclick = () => nav(2);
    qs('startBtn').onclick = () => { rtTrial = 0; rtTimes = []; startRTTrial(); };
    return;
  }

  if (rtPhase === 'done') {
    const avg = Math.round(rtTimes.reduce((a, b) => a + b, 0) / rtTimes.length);
    const tone = avg < 320 ? '#6bbf8e' : avg < 450 ? '#e8a45a' : '#e07b7b';
    const label = avg < 280 ? 'Excellent' : avg < 350 ? 'Normal range' : avg < 500 ? 'Slightly slow' : 'Notably slow';
    m.innerHTML = `
    <div class="page fade-up" style="max-width:560px">
      <div class="step-hdr center">
        <div class="step-tag">Step 3 of 5 — Reaction Test</div>
        <h2 class="step-title">Reaction test complete</h2>
      </div>
      <div class="card glass center">
        <div class="metric-ring" style="--pct:${Math.max(18, 100 - Math.min(avg, 700) / 7)};--accent:${tone};margin:0 auto 16px">
          <div>
            <div class="mono" style="font-size:28px;color:${tone};font-weight:700">${avg}</div>
            <div class="small">ms</div>
          </div>
        </div>
        <div style="font-size:14px;font-weight:700;color:${tone}">${label}</div>
        <div class="grid-auto" style="margin-top:22px">
          ${rtTimes.map((t, i) => `<div class="card" style="padding:12px"><div class="mono small">TRIAL ${i + 1}</div><div class="mono" style="font-size:18px;color:var(--t1);margin-top:4px">${t}ms</div></div>`).join('')}
        </div>
        <div class="nav" style="justify-content:center">
          <button class="btn btn-p" id="nextBtn">Continue →</button>
        </div>
      </div>
    </div>`;
    qs('nextBtn').onclick = () => { state.rts = [...rtTimes]; saveState(); nav(4); };
    return;
  }

  const accent = rtPhase === 'ready' ? '#6bbf8e' : rtPhase === 'early' ? '#e8a45a' : '#e07b7b';
  const label = rtPhase === 'ready' ? 'CLICK' : rtPhase === 'early' ? 'TOO EARLY' : 'WAIT';
  const pct = ((rtTrial + (rtPhase === 'done' ? 1 : 0)) / RT_TRIALS) * 100;

  m.innerHTML = `
  <div class="page fade-up" style="max-width:560px;text-align:center">
    <div class="step-hdr">
      <div class="step-tag">Step 3 of 5 — Reaction Test</div>
      <h2 class="step-title">Trial ${rtTrial + 1} of ${RT_TRIALS}</h2>
      <p class="step-sub">${userName}, click only when the indicator turns green.</p>
    </div>
    <div class="card glass center">
      <div style="margin-bottom:18px"><div class="progress-shell"><div class="progress-bar" style="width:${pct}%"></div></div></div>
      <button id="rtCircle" type="button" aria-label="Reaction test circle" style="width:190px;height:190px;border:none;border-radius:50%;cursor:pointer;background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.35), transparent 30%), ${accent}; box-shadow:0 0 0 16px color-mix(in srgb, ${accent} 18%, transparent), 0 16px 38px color-mix(in srgb, ${accent} 36%, transparent); color:#fff;font-weight:700;letter-spacing:2px;font-size:14px;transition:transform .12s ease;animation:${rtPhase === 'ready' ? 'pulseRing 1s ease-in-out infinite' : 'floatY 3s ease-in-out infinite'}">${label}</button>
      ${rtTimes.length ? `<div class="grid-auto" style="margin-top:24px">${rtTimes.map((t, i) => `<div class="card" style="padding:10px 12px"><div class="mono small">T${i + 1}</div><div class="mono" style="font-size:16px;color:#6bbf8e;margin-top:4px">${t}ms</div></div>`).join('')}</div>` : ''}
    </div>
  </div>`;

  qs('rtCircle').onclick = () => {
    if (rtPhase === 'waiting') {
      clearTimeout(rtTimeout);
      rtPhase = 'early';
      renderReaction();
      rtTimeout = setTimeout(startRTTrial, 1100);
    } else if (rtPhase === 'ready') {
      const t = Date.now() - rtStart;
      rtTimes.push(t);
      rtTrial++;
      if (rtTrial >= RT_TRIALS) {
        rtPhase = 'done';
        renderReaction();
      } else {
        startRTTrial();
      }
    }
  };
}

function startRTTrial() {
  rtPhase = 'waiting';
  renderReaction();
  const delay = 1400 + Math.random() * 2200;
  rtTimeout = setTimeout(() => {
    rtPhase = 'ready';
    rtStart = Date.now();
    renderReaction();
  }, delay);
}

function renderMemory() {
  const m = qs('main');
  const userName = capitalizeName(state.user.name) || 'there';
  if (memPhase === 'intro') {
    m.innerHTML = `
    <div class="page fade-up" style="max-width:600px">
      <div class="step-hdr">
        <div class="step-tag">Step 4 of 5 — Memory Test</div>
        <h2 class="step-title">Digit Span Memory</h2>
        <p class="step-sub">${userName}, remember each sequence and type it back in the same order. This helps estimate short-term working memory.</p>
      </div>
      <div class="card glass center">
        <div class="metric-ring" style="--pct:72;--accent:#8b5cf6;margin:0 auto 18px"><div class="mono" style="font-size:24px;color:#8b5cf6">7</div></div>
        <div style="font-size:14px;color:var(--t3);line-height:1.7;max-width:420px;margin:0 auto">You will see four sequences of increasing length: 3, 4, 5, and 6 digits.</div>
        <div class="nav" style="justify-content:center;margin-top:24px">
          <button class="btn btn-s" id="backBtn">← Back</button>
          <button class="btn btn-p" id="startBtn">Start test</button>
        </div>
      </div>
    </div>`;
    qs('backBtn').onclick = () => nav(3);
    qs('startBtn').onclick = () => { memSeqIdx = 0; memResults = []; startMemSeq(0); };
    return;
  }

  if (memPhase === 'done') {
    const correct = memResults.filter(Boolean).length;
    const tone = correct >= 3 ? '#6bbf8e' : correct >= 2 ? '#e8a45a' : '#e07b7b';
    m.innerHTML = `
    <div class="page fade-up" style="max-width:560px">
      <div class="step-hdr center">
        <div class="step-tag">Step 4 of 5 — Memory Test</div>
        <h2 class="step-title">Memory test complete</h2>
      </div>
      <div class="card glass center">
        <div class="metric-ring" style="--pct:${(correct / MEM_SEQS.length) * 100};--accent:${tone};margin:0 auto 16px">
          <div>
            <div class="mono" style="font-size:28px;color:${tone};font-weight:700">${correct}/${MEM_SEQS.length}</div>
            <div class="small">correct</div>
          </div>
        </div>
        <div class="grid-auto" style="margin-top:20px">
          ${memResults.map((r, i) => `<div class="card" style="padding:12px"><div class="mono small">SEQ ${i + 1}</div><div style="font-size:22px;margin-top:4px">${r ? '✓' : '✗'}</div></div>`).join('')}
        </div>
        <div class="nav" style="justify-content:center">
          <button class="btn btn-p" id="nextBtn">Continue →</button>
        </div>
      </div>
    </div>`;
    qs('nextBtn').onclick = () => { state.memRes = [...memResults]; saveState(); nav(5); };
    return;
  }

  const seq = MEM_SEQS[memSeqIdx];
  let inner = '';
  if (memPhase === 'showing') {
    inner = memDigitIdx >= 0
      ? `<div class="metric-ring" style="--pct:78;--accent:#8b5cf6;margin:0 auto"><div class="mono" style="font-size:38px;color:#8b5cf6;font-weight:700">${seq[memDigitIdx]}</div></div>`
      : `<div class="small pulse" style="font-size:15px;color:var(--t2)">Get ready…</div>`;
  } else if (memPhase === 'input') {
    inner = `<div style="width:100%;max-width:340px;margin:0 auto">
      <p class="small center" style="margin-bottom:12px">Type the sequence in order</p>
      <input class="ifield mono" id="memInput" maxlength="10" autocomplete="off" style="font-size:30px;text-align:center;letter-spacing:12px;padding:16px">
      <button class="btn btn-p" id="memSubmit" disabled style="margin-top:14px;width:100%">Submit answer</button>
    </div>`;
  } else {
    const last = memResults[memResults.length - 1];
    inner = `<div class="center"><div style="font-size:58px;line-height:1">${last ? '✓' : '✗'}</div><div class="small" style="margin-top:10px">Correct sequence: <span class="mono" style="color:var(--t1)">${seq.join('')}</span></div></div>`;
  }

  const progress = ((memSeqIdx + (memPhase === 'feedback' ? 1 : 0)) / MEM_SEQS.length) * 100;
  m.innerHTML = `
  <div class="page fade-up" style="max-width:560px;text-align:center">
    <div class="step-hdr">
      <div class="step-tag">Step 4 of 5 — Memory Test</div>
      <h2 class="step-title">Sequence ${memSeqIdx + 1} of ${MEM_SEQS.length}</h2>
      <p class="step-sub">${memPhase === 'showing' ? 'Watch the digits carefully.' : memPhase === 'input' ? 'Now type what you saw.' : 'Checking your answer…'}</p>
    </div>
    <div class="card glass center">
      <div style="margin-bottom:20px"><div class="progress-shell"><div class="progress-bar" style="width:${progress}%"></div></div></div>
      <div style="min-height:160px;display:grid;place-items:center">${inner}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
        ${MEM_SEQS.map((_, i) => `<div style="height:6px;width:54px;border-radius:999px;background:${i < memResults.length ? (memResults[i] ? '#6bbf8e' : '#e07b7b') : i === memSeqIdx ? '#7c6fcf' : 'var(--b)'}"></div>`).join('')}
      </div>
    </div>
  </div>`;

  if (memPhase === 'input') {
    const inp = qs('memInput');
    const sub = qs('memSubmit');
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, ''); sub.disabled = !inp.value; };
    inp.focus();
    inp.onkeydown = e => { if (e.key === 'Enter' && inp.value) submitMem(inp.value); };
    sub.onclick = () => submitMem(inp.value);
  }
}

function startMemSeq(idx) {
  memSeqIdx = idx;
  memDigitIdx = -1;
  memPhase = 'showing';
  renderMemory();
  const seq = MEM_SEQS[idx];
  let i = 0;
  const tick = () => {
    if (i < seq.length) {
      memDigitIdx = i;
      renderMemory();
      i++;
      memTimeout = setTimeout(() => {
        memDigitIdx = -1;
        renderMemory();
        memTimeout = setTimeout(tick, 220);
      }, 700);
    } else {
      memTimeout = setTimeout(() => {
        memPhase = 'input';
        renderMemory();
      }, 420);
    }
  };
  memTimeout = setTimeout(tick, 580);
}

function submitMem(val) {
  const seq = MEM_SEQS[memSeqIdx];
  memResults.push(val.trim() === seq.join(''));
  memPhase = 'feedback';
  renderMemory();
  memTimeout = setTimeout(() => {
    const next = memSeqIdx + 1;
    if (next >= MEM_SEQS.length) {
      memPhase = 'done';
      renderMemory();
    } else {
      startMemSeq(next);
    }
  }, 1200);
}

function renderLifestyle() {
  const answered = Object.keys(state.life).length;
  const pct = Math.round((answered / LIFESTYLE.length) * 100);
  const m = qs('main');
  const userName = capitalizeName(state.user.name) || 'there';
  m.innerHTML = `
  <div class="page fade-up" style="max-width:680px">
    <div class="step-hdr">
      <div class="step-tag">Step 5 of 5 — Lifestyle</div>
      <h2 class="step-title">Lifestyle Assessment</h2>
      <p class="step-sub">${userName}, these habits strongly affect long-term neurological health, recovery, and resilience.</p>
    </div>

    <div class="card glass" style="margin-bottom:14px;padding:18px 20px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <div class="small">Answered ${answered} of ${LIFESTYLE.length}</div>
        <div class="mono small">${pct}% complete</div>
      </div>
      <div class="progress-shell"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>

    <div class="stack">
      ${LIFESTYLE.map((q, qi) => `
        <div class="card glass panel-hover" style="padding:18px 20px">
          <div style="margin-bottom:14px"><span class="mono" style="font-size:10px;color:var(--teal);margin-right:8px;letter-spacing:1px">Q${qi + 1}</span><span style="font-size:14px;font-weight:600;color:var(--t1)">${q.q}</span></div>
          <div class="grid-2" id="grp-${q.id}">
            ${q.opts.map((opt, oi) => selectableCard('life', opt, state.life[q.id] === oi, `${q.id}|${oi}`)).join('')}
          </div>
        </div>`).join('')}
    </div>

    <div class="nav">
      <button class="btn btn-s" id="backBtn">← Back</button>
      <button class="btn btn-p" id="nextBtn" ${answered < LIFESTYLE.length ? 'disabled' : ''}>Generate report →</button>
    </div>
  </div>`;

  document.querySelectorAll('[data-kind="life"]').forEach(el => {
    el.onclick = () => {
      const [qid, val] = el.dataset.value.split('|');
      state.life[qid] = parseInt(val, 10);
      saveState();
      renderLifestyle();
    };
  });
  qs('backBtn').onclick = () => nav(4);
  qs('nextBtn').onclick = () => nav(6);
}

async function renderResults() {
  let m = qs('main');
  m.innerHTML = `<div class="page fade-up center"><div style="margin-top:40px;font-size:16px;color:var(--t2)" class="pulse">Analysing profile with AI model...</div></div>`;

  let score, factors, rl, previousScoreObj = null;
  try {
    const res = await fetchJson('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.user.email,
        demo: state.demo,
        symptoms: state.symptoms,
        rts: state.rts,
        memRes: state.memRes,
        life: state.life
      })
    });
    score = res.score;
    factors = res.factors;
    rl = res.risk;
    if (res.previous_score !== undefined) {
      previousScoreObj = {
        score: res.previous_score,
        date: res.previous_date,
        change: res.score_change
      };
    }
  } catch (err) {
    console.warn('AI scoring failed, using local fallback:', err);
    const fallback = computeRisk();
    score = fallback.score;
    factors = fallback.factors;
    rl = riskInfo(score);
  }
  const avg = state.rts.length ? Math.round(state.rts.reduce((a, b) => a + b, 0) / state.rts.length) : null;
  const memC = state.memRes.filter(Boolean).length;
  const userName = capitalizeName(state.user.name) || 'there';
  const confidence = getConfidenceInfo();
  const wellness = getWellnessScore(score);
  const breakdown = getCategoryBreakdown();
  const urgentFlags = getUrgentFlags();
  const recs = getRecommendations(score, breakdown);
  const topFactor = factors.length ? [...factors].sort((a, b) => b.v - a.v)[0] : null;

  m = qs('main');
  m.innerHTML = `
  <div class="page fade-up" style="max-width:980px;padding-bottom:60px">
    <div class="center" style="margin-bottom:28px">
      <div class="badge" style="margin-bottom:16px"><span style="width:7px;height:7px;border-radius:50%;background:#7c6fcf"></span> screening complete</div>
      <h2 class="step-title" style="margin-bottom:10px">${userName}, your neurological risk report</h2>
      <p class="step-sub" style="max-width:680px;margin:0 auto">This final view now includes better animation, clearer insight cards, a confidence label, domain hotspots, and a shareable summary.</p>
    </div>

    <div class="result-hero">
      <div class="card glass center panel-hover" style="padding:24px 18px">
        <div class="metric-ring" style="--pct:${scoreToPercent(score)};--accent:${rl.c};margin:0 auto 14px">
          <div>
            <div class="mono" style="font-size:32px;font-weight:700;color:${rl.c}">${score}</div>
            <div class="small">/ 100</div>
          </div>
        </div>
        ${previousScoreObj && previousScoreObj.change !== 0 ? `
        <div style="margin-bottom:14px;padding:6px 12px;border-radius:6px;background:${previousScoreObj.change < 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'};color:${previousScoreObj.change < 0 ? '#22c55e' : '#ef4444'};font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px">
          <span>${previousScoreObj.change < 0 ? '▼' : '▲'}</span>
          <span>${Math.abs(previousScoreObj.change)} points since ${new Date(previousScoreObj.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
        </div><br/>` : previousScoreObj && previousScoreObj.change === 0 ? `
        <div style="margin-bottom:14px;padding:6px 12px;border-radius:6px;background:rgba(156,163,175,.1);color:var(--t2);font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px">
          <span>=</span>
          <span>No score change since ${new Date(previousScoreObj.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
        </div><br/>` : ''}
        <div style="display:inline-flex;align-items:center;justify-content:center;background:${rl.bg};border:1px solid ${rl.bc};border-radius:999px;padding:8px 14px;margin-bottom:12px;color:${rl.c};font-weight:700">${rl.label}</div>
        <div class="small" style="line-height:1.7;color:var(--t2)">${rl.desc}</div>
      </div>

      <div class="stack">
        <div class="grid-3">
          <div class="card glass panel-hover" style="padding:16px 18px">
            <div class="kpi mono">WELLNESS SCORE</div>
            <div class="mono" style="font-size:28px;color:var(--t1);font-weight:700;margin-top:8px">${wellness}</div>
            <div class="small" style="margin-top:4px">Higher is better</div>
          </div>
          <div class="card glass panel-hover" style="padding:16px 18px">
            <div class="kpi mono">CONFIDENCE</div>
            <div style="font-size:18px;color:var(--t1);font-weight:700;margin-top:8px">${confidence.label}</div>
            <div class="small" style="margin-top:4px">${confidence.percent}% data coverage</div>
          </div>
          <div class="card glass panel-hover" style="padding:16px 18px">
            <div class="kpi mono">TOP DRIVER</div>
            <div style="font-size:18px;color:var(--t1);font-weight:700;margin-top:8px">${topFactor ? topFactor.label : 'No major driver'}</div>
            <div class="small" style="margin-top:4px">${topFactor ? '+' + topFactor.v + ' points' : 'Balanced result'}</div>
          </div>
        </div>
        <div class="card glass panel-hover" style="padding:18px 20px">
          <div class="mono kpi" style="margin-bottom:12px">PROFILE SUMMARY</div>
          <div class="grid-3">
            <div><div class="small">Reaction time</div><div class="mono" style="font-size:18px;color:var(--t1);margin-top:6px">${avg !== null ? avg + 'ms' : '—'}</div></div>
            <div><div class="small">Memory score</div><div class="mono" style="font-size:18px;color:var(--t1);margin-top:6px">${memC}/${MEM_SEQS.length}</div></div>
            <div><div class="small">Completed profile</div><div class="mono" style="font-size:18px;color:var(--t1);margin-top:6px">${assessmentCompletion()}%</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card glass panel-hover" style="padding:20px 22px">
        <div class="mono kpi" style="margin-bottom:16px">EXPLAINABLE RISK FACTORS</div>
        ${factors.length === 0 ? `<div style="color:#6bbf8e;font-size:14px">✓ No significant factor cluster detected.</div>` : factors.map(f => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px"><span style="font-size:13px;color:var(--t2)">${f.label}</span><span class="mono" style="font-size:12px;color:${f.c};font-weight:700">+${f.v}</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((f.v / f.max) * 100)}%;background:${f.c}"></div></div>
          </div>`).join('')}
      </div>

      <div class="card glass panel-hover" style="padding:20px 22px">
        <div class="mono kpi" style="margin-bottom:16px">DOMAIN HOTSPOTS</div>
        ${breakdown.map(item => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:6px"><span style="font-size:13px;color:var(--t2)">${item.name}</span><span class="mono" style="font-size:12px;color:${item.accent};font-weight:700">${item.percent}%</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${item.percent}%;background:${item.accent}"></div></div>
          </div>`).join('')}
      </div>
    </div>

    ${urgentFlags.length ? `
      <div class="card glass notice" style="padding:18px 20px;margin-bottom:16px">
        <div class="mono kpi" style="margin-bottom:10px;color:#f59e0b">HIGH-ATTENTION PATTERNS</div>
        <div class="stack">
          ${urgentFlags.map(flag => `<div style="font-size:13px;color:var(--t2);line-height:1.65">• ${flag}</div>`).join('')}
        </div>
      </div>` : ''}

    <div class="card glass panel-hover" style="padding:20px 22px;margin-bottom:16px">
      <div class="mono kpi" style="margin-bottom:16px">PERSONALISED NEXT STEPS</div>
      <div class="stack">
        ${recs.map(rec => `<div style="display:flex;gap:10px;align-items:flex-start;background:var(--s2);border:1px solid var(--b);border-radius:14px;padding:12px 14px"><div style="width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#7c6fcf,#aa89ff);color:#fff;font-size:11px;flex-shrink:0">✓</div><div style="font-size:13px;color:var(--t2);line-height:1.65">${rec}</div></div>`).join('')}
      </div>
    </div>

    <div class="card glass panel-hover" style="padding:18px 20px;margin-bottom:20px">
      <div class="mono kpi" style="margin-bottom:10px">MEDICAL DISCLAIMER</div>
      <div style="font-size:13px;color:var(--t3);line-height:1.75">This project is a research and educational screening prototype. It does not diagnose any neurological condition and should not replace medical evaluation.</div>
    </div>

    <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">
      <button class="btn btn-p" id="downloadPdfBtn" style="background:linear-gradient(135deg,#e07b7b,#d4789a)">Download PDF report</button>
      <button class="btn btn-p" id="emailReportBtn">Email report</button>
      <button class="btn btn-s" id="saveReportBtn">Save report</button>
      <button class="btn btn-s" id="copySummaryBtn">Copy summary</button>
      <button class="btn btn-s" id="restartBtn">Start new screening</button>
    </div>
  </div>`;

  saveState();
  if (qs('restartBtn')) qs('restartBtn').onclick = restartAll;
  if (qs('copySummaryBtn')) qs('copySummaryBtn').onclick = async () => {
    const summary = buildSummary(score, rl, avg, memC, confidence, breakdown, urgentFlags, recs);
    try {
      await navigator.clipboard.writeText(summary);
      const btn = qs('copySummaryBtn');
      if (btn) btn.textContent = 'Copied ✓';
      setTimeout(() => { if (qs('copySummaryBtn')) qs('copySummaryBtn').textContent = 'Copy summary'; }, 1600);
    } catch {
      alert(summary);
    }
  };
  if (qs('emailReportBtn')) qs('emailReportBtn').onclick = () => {
    const summary = buildSummary(score, rl, avg, memC, confidence, breakdown, urgentFlags, recs);
    const subject = `NeuroSense Pro report for ${userName}`;
    window.location.href = getMailtoHref(state.user.email || '', subject, summary);
  };
  if (qs('saveReportBtn')) qs('saveReportBtn').onclick = async () => {
    const summary = buildSummary(score, rl, avg, memC, confidence, breakdown, urgentFlags, recs);
    const subject = `NeuroSense Pro report for ${userName}`;
    await saveReportToServer(subject, summary);
    const btn = qs('saveReportBtn');
    if (btn) btn.textContent = 'Saved ✓';
    setTimeout(() => { if (qs('saveReportBtn')) qs('saveReportBtn').textContent = 'Save report'; }, 1600);
  };

  const dlBtn = qs('downloadPdfBtn');
  if (dlBtn) dlBtn.onclick = async () => {
    dlBtn.disabled = true;
    const originalText = dlBtn.textContent;
    dlBtn.textContent = 'Generating...';
    try {
      const payload = {
        user: state.user,
        email: state.user.email,
        demo: state.demo,
        symptoms: state.symptoms,
        rts: state.rts,
        memRes: state.memRes,
        life: state.life
      };
      const res = await fetch('/api/download_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('PDF Generation Failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NeuroSense_Report_${state.user.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download Error: ' + err.message);
    } finally {
      dlBtn.disabled = false;
      dlBtn.textContent = originalText;
    }
  };

  saveProfileToServer();
}

function buildSummary(score, rl, avg, memC, confidence, breakdown, urgentFlags, recs) {
  return [
    'NeuroSense Pro — Screening Summary',
    `Risk score: ${score}/100 (${rl.label})`,
    `Reaction time: ${avg !== null ? avg + ' ms' : 'Not available'}`,
    `Memory score: ${memC}/${MEM_SEQS.length}`,
    `Confidence: ${confidence.label} (${confidence.percent}% data coverage)`,
    `Top symptom domain: ${breakdown[0]?.name || 'N/A'}`,
    urgentFlags.length ? `High-attention patterns: ${urgentFlags.join('; ')}` : 'High-attention patterns: none',
    'Recommended next steps:',
    ...recs.map((r, i) => `${i + 1}. ${r}`),
    '',
    'This is an educational screening prototype and not a diagnosis.'
  ].join('\n');
}

function selectableCard(kind, label, selected, value = label) {
  return `<div class="rcard ${selected ? 'sel' : ''}" data-kind="${kind}" data-value="${value}">
    <div style="width:16px;height:16px;border-radius:50%;border:2px solid ${selected ? '#7c6fcf' : 'var(--b2)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">${selected ? '<div style="width:7px;height:7px;border-radius:50%;background:#7c6fcf"></div>' : ''}</div>
    <span style="font-size:13px;color:var(--t2)">${label}</span>
  </div>`;
}

function attachOptionHandlers(groupId, setter) {
  qs(groupId).querySelectorAll('.rcard').forEach(el => {
    el.onclick = () => { setter(el.dataset.value); saveState(); };
  });
}

function getProfileCompletion() {
  let done = 0;
  if (state.demo.age) done += 25;
  if (state.demo.sex) done += 25;
  if (state.demo.fh) done += 25;
  if (state.demo.edu) done += 25;
  return done;
}

initTheme();
nav(0); // Always start at the landing page to show the new UI
