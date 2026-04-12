const SYMPTOMS = [
  { id:'s1',  text:'Difficulty remembering recent events or conversations',       w:3,   cat:'Memory'   },
  { id:'s2',  text:'Getting lost in familiar places or losing sense of direction', w:2.5, cat:'Spatial'   },
  { id:'s3',  text:'Trouble finding words or following conversations',              w:2.5, cat:'Language'  },
  { id:'s4',  text:'Frequent unexplained headaches or dizziness',                   w:1.5, cat:'Physical'  },
  { id:'s5',  text:'Changes in handwriting or fine motor difficulty',               w:2,   cat:'Motor'     },
  { id:'s6',  text:'Tremors, muscle stiffness, or rigidity at rest',                w:3,   cat:'Motor'     },
  { id:'s7',  text:'Significant mood changes, depression, or anxiety',              w:1.5, cat:'Mood'      },
  { id:'s8',  text:'Difficulty concentrating or making decisions',                  w:2,   cat:'Cognitive' },
  { id:'s9',  text:'Sleep disturbances, restless sleep, or acting out dreams',      w:2,   cat:'Sleep'     },
  { id:'s10', text:'Balance problems or unexplained falls',                         w:2.5, cat:'Motor'     },
];

const LIFESTYLE = [
  {
    id: 'l1',
    q: 'How many hours of sleep do you get per night?',
    opts: ['Less than 5 hrs', '5–6 hrs', '7–8 hrs', 'More than 8 hrs'],
    risk: [3, 1.5, 0, 0.5]
  },
  {
    id: 'l2',
    q: 'How often do you exercise?',
    opts: ['Never', '1–2× per month', '1–2× per week', '3+ times per week'],
    risk: [3, 2, 1, 0]
  },
  {
    id: 'l3',
    q: 'Do you currently smoke or use tobacco?',
    opts: ['Heavy smoker', 'Occasional smoker', 'Ex-smoker', 'Never smoked'],
    risk: [3, 2, 1, 0]
  },
  {
    id: 'l4',
    q: 'How would you rate your typical diet quality?',
    opts: ['Poor (processed/fast food)', 'Average', 'Good (balanced meals)', 'Excellent (Mediterranean-style)'],
    risk: [2, 1, 0, 0]
  },
  {
    id: 'l5',
    q: 'How often do you engage in mentally stimulating activities?',
    opts: ['Rarely or never', 'Sometimes', 'Often', 'Daily (reading, puzzles, learning)'],
    risk: [2, 1, 0.5, 0]
  },
];

const MEM_SEQS = [
  [4, 7, 2],
  [6, 1, 9, 3],
  [2, 8, 5, 1, 7],
  [9, 3, 6, 2, 8, 4]
];

const RT_TRIALS = 5;

const CATEGORY_ACCENTS = {
  Memory: '#a98bd4',
  Spatial: '#6aaed6',
  Language: '#7ab89a',
  Physical: '#e8a45a',
  Motor: '#d4789a',
  Mood: '#8c8cf4',
  Cognitive: '#7c6fcf',
  Sleep: '#5fa8d3'
};
