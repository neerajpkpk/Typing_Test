// ─── State ───────────────────────────────────────────────
let allPassages = [];
let currentPassageIndex = 0;
let currentDifficulty = 'easy';
let passagesByDifficulty = { easy: [], medium: [], hard: [] };
let testTime = 60, currentTime = 60, timer = null;
let started = false, paused = false;
let currentIndex = 0, errors = 0, totalTyped = 0, correctChars = 0;

// BUG FIX #2: Track cumulative stats across passages in one test
let cumulativeErrors = 0, cumulativeTyped = 0, cumulativeCorrect = 0;

let passageText = '';
let history = [];
let sortMode = 'date';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// ─── Load passages.json ───────────────────────────────────
async function loadPassages() {
  document.getElementById('loading-bar').style.display = 'block';
  document.getElementById('test-panel').style.display = 'none';
  try {
    const res = await fetch('passages.json');
    if (!res.ok) throw new Error('File not found');
    const data = await res.json();

    // Support both old flat array and new difficulty object
    if (Array.isArray(data.passages)) {
      passagesByDifficulty = { easy: data.passages, medium: data.passages, hard: data.passages };
    } else {
      passagesByDifficulty = data.passages;
    }

    shuffle(passagesByDifficulty.easy);
    shuffle(passagesByDifficulty.medium);
    shuffle(passagesByDifficulty.hard);

    allPassages = passagesByDifficulty[currentDifficulty];
    document.getElementById('db-status').textContent = '✅ Loaded';
    updateDbCount();
  } catch (e) {
    document.getElementById('db-status').textContent = '⚠️ passages.json not found';
    document.getElementById('db-count').textContent = 'Keep all files in same folder';
    passagesByDifficulty = {
      easy:   ["The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."],
      medium: ["The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."],
      hard:   ["The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."]
    };
    allPassages = passagesByDifficulty[currentDifficulty];
  }
  document.getElementById('loading-bar').style.display = 'none';
  document.getElementById('test-panel').style.display = 'block';
  currentPassageIndex = 0;
  buildPassage();
  focusInput();
}

function updateDbCount() {
  const e = passagesByDifficulty.easy.length;
  const m = passagesByDifficulty.medium.length;
  const h = passagesByDifficulty.hard.length;
  document.getElementById('db-count').textContent = `Easy: ${e} | Medium: ${m} | Hard: ${h}`;
}

function setDifficulty(level, el) {
  currentDifficulty = level;
  document.querySelectorAll('.btn-diff-inline').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  allPassages = passagesByDifficulty[level];
  shuffle(allPassages);
  currentPassageIndex = 0;
  resetTest();
}

// ─── Helpers ──────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getNextPassage() {
  // BUG FIX #3: Removed unused usedIndices array, simplified logic
  if (currentPassageIndex >= allPassages.length) {
    currentPassageIndex = 0;
    shuffle(allPassages);
  }
  const text = allPassages[currentPassageIndex];
  currentPassageIndex++;
  return { text, num: currentPassageIndex, total: allPassages.length };
}

function formatTime(s) {
  return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60;
}

function focusInput() {
  document.getElementById('hidden-input').focus();
}

// ─── Sidebar: select test ─────────────────────────────────
function selectTest(el, time) {
  document.querySelectorAll('.test-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  testTime = time;
  currentTime = time;
  resetTest();
}

function startTest(e) {
  e.stopPropagation();
  // Get the parent <li> and call selectTest with its time
  const li = e.target.closest('.test-item');
  if (li) {
    const onclickAttr = li.getAttribute('onclick');
    const match = onclickAttr && onclickAttr.match(/selectTest\(this,\s*(\d+)\)/);
    if (match) {
      selectTest(li, parseInt(match[1]));
    }
  } else {
    resetTest();
  }
  focusInput();
}

function nextPassage() {
  resetTest();
}

// ─── Build passage from JSON ──────────────────────────────
function buildPassage() {
  const p = getNextPassage();
  passageText = p.text;
  document.getElementById('passage-meta').textContent = 'Passage #' + p.num + ' of ' + p.total;
  const container = document.getElementById('chars-container');
  container.innerHTML = '';
  for (let i = 0; i < passageText.length; i++) {
    const span = document.createElement('span');
    span.className = 'char ' + (i === 0 ? 'current' : 'pending');
    span.id = 'c' + i;
    span.textContent = passageText[i];
    container.appendChild(span);
  }
}

// ─── Live stats ───────────────────────────────────────────
function updateStats() {
  const elapsed = testTime - currentTime;
  const mins = elapsed / 60 || 0.001;
  // BUG FIX #2: Use cumulative stats so passage transitions don't reset WPM/Acc
  const totalCorrect = cumulativeCorrect + correctChars;
  const totalAll     = cumulativeTyped  + totalTyped;
  const totalErr     = cumulativeErrors + errors;
  const wpm = Math.round((totalCorrect / 5) / mins);
  // Accuracy = correct chars / total typed (correct + wrong both counted)
  const acc = totalAll > 0 ? Math.round(((totalAll - totalErr) / totalAll) * 100) : 100;
  document.getElementById('live-wpm').textContent    = wpm;
  document.getElementById('live-acc').textContent    = acc + '%';
  document.getElementById('live-chars').textContent  = totalCorrect;
  document.getElementById('live-errors').textContent = cumulativeErrors + errors;
}

// ─── Reset ────────────────────────────────────────────────
function resetTest() {
  clearInterval(timer);
  started = false; paused = false; currentIndex = 0;
  errors = 0; totalTyped = 0; correctChars = 0;
  // BUG FIX #2: Also reset cumulative counters on full reset
  cumulativeErrors = 0; cumulativeTyped = 0; cumulativeCorrect = 0;
  currentTime = testTime;
  document.getElementById('timer-display').textContent   = formatTime(currentTime);
  document.getElementById('live-wpm').textContent        = '0';
  document.getElementById('live-acc').textContent        = '100%';
  document.getElementById('live-chars').textContent      = '0';
  document.getElementById('live-errors').textContent     = '0';
  document.getElementById('hidden-input').value          = '';
  document.getElementById('test-panel').style.display    = 'block';
  document.getElementById('results-panel').classList.remove('show');
  document.getElementById('pause-msg').style.display     = 'flex';
  document.getElementById('pause-msg').textContent       = '⌨️  Start Typing!';
  buildPassage();
}

// ─── Finish ───────────────────────────────────────────────
function finishTest() {
  clearInterval(timer);
  const elapsed = testTime - currentTime;
  const mins = elapsed / 60 || 0.001;
  const totalCorrect = cumulativeCorrect + correctChars;
  const totalAll     = cumulativeTyped  + totalTyped;
  const totalErr     = cumulativeErrors + errors;
  const wpm = Math.round((totalCorrect / 5) / mins);
  const acc = totalAll > 0 ? Math.round((totalCorrect / totalAll) * 100) : 100;
  document.getElementById('test-panel').style.display = 'none';
  document.getElementById('results-panel').classList.add('show');
  document.getElementById('res-wpm').textContent    = wpm;
  document.getElementById('res-acc').textContent    = acc + '%';
  document.getElementById('res-chars').textContent  = totalCorrect;
  document.getElementById('res-errors').textContent = totalErr;
  history.push({ wpm, acc, errors: totalErr, date: new Date(), duration: testTime });
  renderHistory();
}

// ─── Certificate ──────────────────────────────────────────
function buildCertHTML(h) {
  return `<html><head><title>Typing Certificate</title>
  <style>
    body { font-family: Georgia, serif; text-align: center; padding: 60px; background: #fff; }
    h1   { font-size: 36px; color: #1a8fc1; margin-bottom: 8px; }
    .wpm { font-size: 72px; font-weight: bold; color: #1a8fc1; }
    .sub { font-size: 18px; color: #64748b; margin: 8px 0; }
    .box { border: 4px double #1a8fc1; padding: 40px; display: inline-block; margin-top: 20px; }
  </style></head><body>
  <div class="box">
    <h1>🏆 Typing Certificate</h1>
    <div class="sub">This certifies that you typed at</div>
    <div class="wpm">${h.wpm} WPM</div>
    <div class="sub">with ${h.acc}% accuracy</div>
    <div class="sub" style="margin-top:20px;font-size:14px">
      ${h.date.toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}
    </div>
  </div></body></html>`;
}

function printCert() {
  const last = history[history.length - 1];
  if (!last) return alert('Pehle ek test complete karo!');
  const win = window.open('', '_blank');
  win.document.write(buildCertHTML(last));
  win.print();
}

function printCertFromHistory(idx) {
  const h = history[idx];
  const win = window.open('', '_blank');
  win.document.write(buildCertHTML(h));
  win.print();
}

// ─── History ──────────────────────────────────────────────
function sortHistory(mode, el) {
  sortMode = mode;
  document.querySelectorAll('.sort-link').forEach(l => l.classList.remove('active-sort'));
  el.classList.add('active-sort');
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const noH  = document.getElementById('no-history');
  if (!history.length) { noH.style.display = 'block'; list.innerHTML = ''; return; }
  noH.style.display = 'none';
  let sorted = [...history];
  if (sortMode === 'wpm') sorted.sort((a, b) => b.wpm - a.wpm);
  else if (sortMode === 'acc') sorted.sort((a, b) => b.acc - a.acc);
  else sorted.sort((a, b) => b.date - a.date);

  list.innerHTML = sorted.slice(0, 30).map((h, i) => `
    <div class="history-item">
      <div class="date-box">
        <div class="date-month">${MONTHS[h.date.getMonth()]}</div>
        <div class="date-day">${h.date.getDate()}</div>
        <div class="date-year">${h.date.getFullYear()}</div>
      </div>
      <div class="hist-stats">
        <div><div class="hist-val">${h.wpm} WPM</div><div class="hist-label">Speed</div></div>
        <div><div class="hist-val">${h.acc}%</div><div class="hist-label">Accuracy</div></div>
        <div><div class="hist-val">${h.errors}</div><div class="hist-label">Errors</div></div>
        <div><div class="hist-val">${h.duration}s</div><div class="hist-label">Duration</div></div>
      </div>
      <button class="btn-cert-sm" onclick="printCertFromHistory(${history.indexOf(h)})">🏆 Certificate</button>
    </div>`).join('');
}

// ─── Keyboard events ──────────────────────────────────────
document.getElementById('hidden-input').addEventListener('keydown', function (e) {
  if (e.key === 'Tab') { e.preventDefault(); return; }

  // Keyboard shortcuts: Esc = reset, F2 = next passage
  if (e.key === 'Escape') { resetTest(); return; }

  if (currentIndex >= passageText.length) return;

  if (!started) {
    started = true;
    document.getElementById('pause-msg').style.display = 'none';
    timer = setInterval(() => {
      currentTime--;
      document.getElementById('timer-display').textContent = formatTime(currentTime);
      updateStats();
      if (currentTime <= 0) finishTest();
    }, 1000);
  }

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (currentIndex > 0) {
      currentIndex--;
      const prevEl = document.getElementById('c' + currentIndex);
      // BUG FIX #1: If previous char was wrong, decrement errors count
      if (prevEl.classList.contains('wrong')) {
        errors = Math.max(0, errors - 1);
        totalTyped = Math.max(0, totalTyped - 1);
      } else if (prevEl.classList.contains('correct')) {
        correctChars = Math.max(0, correctChars - 1);
        totalTyped   = Math.max(0, totalTyped - 1);
      }
      prevEl.className = 'char current';
      // Remove 'current' from next char (if any)
      const nextEl = document.getElementById('c' + (currentIndex + 1));
      if (nextEl && nextEl.classList.contains('current')) {
        nextEl.className = 'char pending';
      }
    }
    updateStats();
    return;
  }

  if (e.key.length !== 1) return;

  totalTyped++;
  const charEl = document.getElementById('c' + currentIndex);
  const nextEl = document.getElementById('c' + (currentIndex + 1));

  if (e.key === passageText[currentIndex]) {
    charEl.className = 'char correct';
    correctChars++;
  } else {
    charEl.className = 'char wrong';
    errors++;
  }

  currentIndex++;
  if (nextEl) {
    nextEl.className = 'char current';
  } else {
    // BUG FIX #2: Passage complete — carry over stats, don't reset them
    cumulativeErrors  += errors;
    cumulativeTyped   += totalTyped;
    cumulativeCorrect += correctChars;
    errors = 0; totalTyped = 0; correctChars = 0;
    currentIndex = 0;
    buildPassage();
  }
  updateStats();
});

document.getElementById('hidden-input').addEventListener('blur', function () {
  if (started && !paused) {
    paused = true;
    clearInterval(timer);
    document.getElementById('pause-msg').style.display = 'flex';
    document.getElementById('pause-msg').textContent = '⏱️  Timer paused. Click here to resume.';
  }
});

document.getElementById('hidden-input').addEventListener('focus', function () {
  if (started && paused) {
    paused = false;
    document.getElementById('pause-msg').style.display = 'none';
    timer = setInterval(() => {
      currentTime--;
      document.getElementById('timer-display').textContent = formatTime(currentTime);
      updateStats();
      if (currentTime <= 0) finishTest();
    }, 1000);
  }
});

// ─── Init ─────────────────────────────────────────────────
loadPassages();