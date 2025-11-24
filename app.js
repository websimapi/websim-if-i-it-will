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

// --- REPLACED: local aiGenerate with AI-backed generator (websim) and fallback --- //
function localFallbackGenerate(a,b){
  // original deterministic fallback kept small and clear
  const action = a.toLowerCase();
  const target = b.toLowerCase();
  const recipes = {
    chop: { oak: "Oak Log", pine: "Pine Log", birch: "Birch Log", shrub: "Wood Bundle" },
    mine: { iron: "Iron Ore", copper: "Copper Ore", stone: "Stone Chunk", coal: "Coal Lump" },
    harvest: { wheat: "Wheat Sheaf", berry: "Berries", herb: "Herb Bundle", apple: "Apple" },
    gather: { herb: "Herb Bundle", mushroom: "Mushrooms", fiber: "Cloth Fiber" },
    smelt: { "iron ore": "Iron Ingot", "copper ore": "Copper Ingot", ore: "Refined Metal", scrap: "Refined Metal" },
    refine: { ore: "Refined Metal", oil: "Fuel", herb: "Pure Extract" },
    cook: { fish: "Cooked Fish", meat: "Cooked Meat", apple: "Baked Apple" },
    craft: { plank: "Wood Plank", log: "Wood Plank", "iron ingot": "Iron Plate" }
  };
  const directMap = { oak: "Oak Log", iron: "Iron Ore", stone: "Stone Chunk", wheat: "Wheat Sheaf", berry: "Berries", fish: "Raw Fish", meat: "Raw Meat", apple: "Apple", coal: "Coal Lump" };

  if (recipes[action] && (recipes[action][target] || recipes[action][`${target}s`])) {
    const out = recipes[action][target] || recipes[action][`${target}s`];
    return `Result: ${out}`;
  }
  if (recipes[action]) {
    const first = Object.values(recipes[action])[0];
    return `Result: ${first} (from ${action} ${target})`;
  }
  if (directMap[target]) return `Result: ${directMap[target]}`;
  const resourceVerbs = ['chop','mine','harvest','gather','smelt','refine','cook','craft'];
  if (resourceVerbs.includes(action)) {
    const cap = target.split(' ').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
    if (['smelt','refine','craft'].includes(action)) return `Result: Refined ${cap}`;
    if (['cook'].includes(action)) return `Result: Cooked ${cap}`;
    return `Result: ${cap} (raw resource)`;
  }
  const capA = action.charAt(0).toUpperCase()+action.slice(1);
  const capB = target.charAt(0).toUpperCase()+target.slice(1);
  return `Result: ${capA} ${capB} (an unusual outcome)`;
}

async function aiGenerate(a,b){
  // Use websim chat completion to generate a concise RPG-style outcome.
  // The assistant MUST reply with a single short line beginning with "Result: " and the item name (no extra explanation).
  try{
    const prompt = `You are a concise RPG crafting/outcome assistant. Given the player phrase "If I ${a} ${b} it will become?", respond with exactly one line formatted as: Result: <Item Name>
Do not include any other text, commentary, or code. Use common-sense RPG conversions (e.g., chopping wood => "Oak Log", mining iron => "Iron Ore", cooking meat => "Cooked Meat"). If uncertain, produce a plausible single-item result.`;

    const completion = await websim.chat.completions.create({
      messages: [
        { role: "system", content: "You are an RPG assistant that returns a single-line concise crafting/result outcome prefixed with 'Result:'." },
        { role: "user", content: prompt }
      ],
      // keep response small and fast
      max_tokens: 40,
      temperature: 0.3
    });

    const reply = (completion?.content || "").trim();
    // Basic sanity check: ensure it starts with "Result:"; otherwise fallback
    if (reply.toLowerCase().startsWith('result:')) return reply;
    // Sometimes model returns JSON or extra—extract first line that starts with Result:
    const lines = reply.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const found = lines.find(l=>l.toLowerCase().startsWith('result:'));
    if (found) return found;
    // fallback to local generator
    return localFallbackGenerate(a,b);
  }catch(err){
    // network or websim error -> fallback
    return localFallbackGenerate(a,b);
  }
}
// --- end replacement --- //

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
  const reply = await aiGenerate(val1, val2);
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