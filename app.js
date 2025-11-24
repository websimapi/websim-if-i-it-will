// Basic single-page app: validate two single-word English words (no spaces) using a public dictionary API,
// then generate a friendly AI-style response locally.

const form = document.getElementById('fill-form');
const w1 = document.getElementById('w1');
const w2 = document.getElementById('w2');
const status = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const clearBtn = document.getElementById('clear-btn');
const aiSection = document.getElementById('ai-response');
const responseText = document.getElementById('response-text');
const tryAgain = document.getElementById('try-again');

function normalize(word){
  return (word || '').trim().toLowerCase();
}

function simpleLocalCheck(word){
  // Must be letters or hyphen/apostrophe allowed inside but not whitespace
  return /^[a-zA-Z'-]+$/.test(word);
}

async function isEnglishWord(word){
  // quick local check first
  if (!simpleLocalCheck(word)) return false;
  // Use free dictionary API to confirm existence
  try{
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {cache: "no-store"});
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length>0;
  }catch(e){
    // If network error, fallback: accept common short words heuristically
    return word.length <= 6;
  }
}

function setStatus(msg, isError=false){
  status.textContent = msg;
  status.style.color = isError ? getComputedStyle(document.documentElement).getPropertyValue('--err') : '';
}

function aiGenerate(a,b){
  // Generate a short playful response using the two words.
  const templates = [
    `If you ${a} ${b}, you might be surprised what it becomes — give it a try.`,
    `"${a} ${b}" could transform things in unexpected ways; experiment and see.`,
    `Try ${a} ${b} and observe how it becomes something new.`,
    `When you ${a} ${b}, things often become more interesting.`,
    `Do ${a} ${b} and notice how it becomes a different story.`
  ];
  const idx = Math.floor(Math.random()*templates.length);
  return templates[idx];
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('');
  aiSection.hidden = true;
  const val1 = normalize(w1.value);
  const val2 = normalize(w2.value);

  if (!val1 || !val2) {
    setStatus('Please fill both words (one word each).', true);
    return;
  }

  setStatus('Checking words...');
  submitBtn.disabled = true;
  clearBtn.disabled = true;

  const checks = await Promise.all([isEnglishWord(val1), isEnglishWord(val2)]);
  submitBtn.disabled = false;
  clearBtn.disabled = false;

  const badIndices = checks.map((ok,i)=>!ok?i:null).filter(x=>x!==null);
  if (badIndices.length){
    const labels = {0:'first',1:'second'};
    const which = badIndices.map(i=>labels[i]).join(', ');
    setStatus(`Rejected: ${which} word not recognized as a valid English word.`, true);
    return;
  }

  setStatus('Generating response...');
  // Simulate short thinking delay for UX
  await new Promise(r=>setTimeout(r, 600));
  const reply = aiGenerate(val1, val2);
  responseText.textContent = reply;
  aiSection.hidden = false;
  setStatus('Completed.');
});

clearBtn.addEventListener('click', ()=>{
  w1.value = w2.value = '';
  setStatus('');
  aiSection.hidden = true;
});

tryAgain.addEventListener('click', ()=>{
  aiSection.hidden = true;
  setStatus('');
  w1.focus();
});

// small UX: enter moves to next field
[w1,w2].forEach((el,idx,arr)=>{
  el.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = arr[idx+1];
      if (next) next.focus();
      else submitBtn.focus();
    }
  });
});