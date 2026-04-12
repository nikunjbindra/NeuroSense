function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function computeRisk() {
  let score = 0;
  const factors = [];
  const age = parseInt(state.demo.age, 10) || 0;

  const ageScore = age >= 76 ? 25
                 : age >= 66 ? 18
                 : age >= 56 ? 12
                 : age >= 46 ? 6
                 : 0;
  if (ageScore > 0) factors.push({ label: 'Age factor', v: ageScore, max: 25, c: '#f59e0b' });
  score += ageScore;

  if (state.demo.fh === 'yes') {
    score += 20;
    factors.push({ label: 'Family history', v: 20, max: 20, c: '#ef4444' });
  }

  if (state.demo.edu === 'postgrad') score -= 3;
  else if (state.demo.edu === 'degree') score -= 1.5;

  const sMax = SYMPTOMS.reduce((a, s) => a + s.w * 3, 0);
  const sRaw = SYMPTOMS.reduce((a, s) => a + (state.symptoms[s.id] || 0) * s.w, 0);
  const sScore = Math.round((sRaw / sMax) * 30);
  if (sScore > 0) factors.push({ label: 'Symptom profile', v: sScore, max: 30, c: '#f97316' });
  score += sScore;

  if (state.rts.length > 0) {
    const avg = state.rts.reduce((a, b) => a + b, 0) / state.rts.length;
    const base = age < 40 ? 280 : age < 55 ? 320 : age < 70 ? 380 : 440;
    const rtS = avg > base + 200 ? 12
             : avg > base + 100 ? 8
             : avg > base ? 4
             : 0;
    if (rtS > 0) factors.push({ label: 'Reaction time', v: rtS, max: 12, c: '#14b8a6' });
    score += rtS;
  }

  if (state.memRes.length > 0) {
    const correct = state.memRes.filter(Boolean).length;
    const mS = Math.round(((MEM_SEQS.length - correct) / MEM_SEQS.length) * 10);
    if (mS > 0) factors.push({ label: 'Memory performance', v: mS, max: 10, c: '#8b5cf6' });
    score += mS;
  }

  const lRaw = LIFESTYLE.reduce((a, q) => a + (state.life[q.id] !== undefined ? q.risk[state.life[q.id]] : 0), 0);
  const lS = Math.round(Math.min(lRaw * 1.5, 15));
  if (lS > 0) factors.push({ label: 'Lifestyle factors', v: lS, max: 15, c: '#60a5fa' });
  score += lS;

  return { score: clamp(Math.round(score), 0, 100), factors };
}

function riskInfo(score) {
  if (score < 25) return {
    label: 'Low risk',
    c: '#22c55e', bg: 'rgba(34,197,94,.12)', bc: 'rgba(34,197,94,.32)',
    desc: 'No major warning pattern was detected in this screening. Maintain healthy routines and keep monitoring changes over time.'
  };
  if (score < 50) return {
    label: 'Moderate risk',
    c: '#f59e0b', bg: 'rgba(245,158,11,.12)', bc: 'rgba(245,158,11,.32)',
    desc: 'Some indicators are present. A routine medical discussion is reasonable, especially if symptoms are increasing.'
  };
  if (score < 70) return {
    label: 'Elevated risk',
    c: '#f97316', bg: 'rgba(249,115,22,.12)', bc: 'rgba(249,115,22,.32)',
    desc: 'Multiple indicators appear together. A proper neurological review is recommended in the near future.'
  };
  return {
    label: 'High risk',
    c: '#ef4444', bg: 'rgba(239,68,68,.12)', bc: 'rgba(239,68,68,.32)',
    desc: 'Several strong indicators are present. Please seek evaluation from a qualified medical professional as soon as possible.'
  };
}

function getCategoryBreakdown() {
  const totals = {};
  for (const s of SYMPTOMS) {
    totals[s.cat] ??= { score: 0, max: 0, count: 0, accent: CATEGORY_ACCENTS[s.cat] || '#7c6fcf' };
    totals[s.cat].score += (state.symptoms[s.id] || 0) * s.w;
    totals[s.cat].max += 3 * s.w;
    totals[s.cat].count += 1;
  }
  return Object.entries(totals)
    .map(([name, val]) => ({
      name,
      accent: val.accent,
      percent: val.max ? Math.round((val.score / val.max) * 100) : 0,
      score: val.score,
      max: val.max
    }))
    .sort((a, b) => b.percent - a.percent);
}

function getUrgentFlags() {
  const map = Object.fromEntries(SYMPTOMS.map(s => [s.id, s]));
  const flags = [];
  ['s2', 's6', 's10'].forEach(id => {
    if ((state.symptoms[id] || 0) >= 2) flags.push(map[id].text);
  });
  return flags;
}

function getConfidenceInfo() {
  let answered = 0;
  const total = 4 + SYMPTOMS.length + LIFESTYLE.length + 2;
  if (state.demo.age) answered += 1;
  if (state.demo.sex) answered += 1;
  if (state.demo.fh) answered += 1;
  if (state.demo.edu) answered += 1;
  answered += Object.keys(state.symptoms).length;
  answered += Object.keys(state.life).length;
  if (state.rts.length) answered += 1;
  if (state.memRes.length) answered += 1;

  const ratio = answered / total;
  const label = ratio > 0.95 ? 'High confidence'
              : ratio > 0.75 ? 'Moderate confidence'
              : 'Low confidence';
  return {
    answered,
    total,
    ratio,
    percent: Math.round(ratio * 100),
    label
  };
}

function getWellnessScore(score) {
  return clamp(100 - score, 0, 100);
}

function getRecommendations(score, breakdown) {
  const recs = [];
  const top = breakdown[0]?.name;

  if (score >= 30) recs.push('Book a routine consultation with a physician or neurologist and share this screening summary.');
  if (score >= 50) recs.push('Track symptoms weekly so worsening trends can be discussed with a clinician early.');
  if (top === 'Memory' || top === 'Cognitive') recs.push('Increase mentally stimulating activities like reading, problem solving, language practice, or memory games.');
  if (top === 'Sleep') recs.push('Improve sleep consistency with a fixed bedtime, lower late-night screen time, and better sleep hygiene.');
  if (top === 'Motor') recs.push('Pay attention to balance, gait, tremor, and coordination changes, especially if they are becoming more frequent.');
  if ((state.life.l2 ?? 3) <= 1) recs.push('Aim for regular physical activity such as walking, cycling, stretching, or light strength training most weeks.');
  if ((state.life.l4 ?? 3) <= 1) recs.push('Shift toward a more brain-friendly eating pattern with vegetables, whole grains, nuts, fish, and less processed food.');
  if ((state.life.l1 ?? 3) <= 1) recs.push('Prioritise 7–9 hours of sleep because sleep strongly affects memory, mood, and cognitive speed.');
  if ((state.life.l3 ?? 3) <= 1) recs.push('Reducing tobacco exposure can improve long-term vascular and neurological health.');
  recs.push('This tool is for research and educational screening only, not for diagnosis.');

  return [...new Set(recs)].slice(0, 6);
}
