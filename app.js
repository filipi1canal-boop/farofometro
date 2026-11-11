// ══════════════════════════════════════════════════════
//  FAROFÔMETRO — Tropical App Core v4
// ══════════════════════════════════════════════════════

// ── SVG Icons for voting ────────────────────────────────
const EMOJIS = [
  {
    id: 'heart', label: 'Amei', color: '#FF6B9D', bg: 'rgba(255,107,157,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="#FF6B9D" stroke="#D94F7A" stroke-width="1.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
  },
  {
    id: 'happy', label: 'Divertido', color: '#FFD60A', bg: 'rgba(255,214,10,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="#FFD60A" stroke="#CCA800" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'sad', label: 'Decepcionou', color: '#74B3CE', bg: 'rgba(116,179,206,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="#74B3CE" stroke="#3A82A6" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 13c0 2-1 3-1 3" stroke="#5BC0EB"/></svg>`
  },
  {
    id: 'angry', label: 'Falso', color: '#FF6B35', bg: 'rgba(255,107,53,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="#FF6B35" stroke="#CC4A1A" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9l2 1M15 9l-2 1" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'plant', label: 'Planta', color: '#52B788', bg: 'rgba(82,183,136,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="#52B788" stroke="#2D6A4F" stroke-width="1.5"><path d="M12 22V12M12 12C12 12 5 10 5 4C5 4 11 4 12 12ZM12 16C12 16 19 14 19 6C19 6 13 4 12 16Z" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'vomit', label: 'Nojo', color: '#95D5B2', bg: 'rgba(149,213,178,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="#95D5B2" stroke="#52B788" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M9 10h.01M15 10h.01"/><path d="M10 15l1 2 2-2 2 1" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'bomb', label: 'Fofoqueira', color: '#495057', bg: 'rgba(73,80,87,0.2)',
    icon: `<svg viewBox="0 0 24 24" fill="#495057" stroke="#343A40" stroke-width="1.5"><circle cx="11" cy="13" r="8"/><path d="M16 8l1-1M19 6l-1-1M21 8l-1 1M17 3l1 1" stroke="#FFD60A" stroke-width="2" stroke-linecap="round"/></svg>`
  },
  {
    id: 'luggage', label: 'Mala', color: '#E9C46A', bg: 'rgba(233,196,106,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="#E9C46A" stroke="#B08D38" stroke-width="1.5"><rect x="4" y="9" width="16" height="12" rx="2"/><path d="M8 9V6C8 4.89543 8.89543 4 10 4H14C15.1046 4 16 4.89543 16 6V9" fill="none"/><path d="M12 9v12M4 14h16"/></svg>`
  },
  {
    id: 'target', label: 'Biscoiteira', color: '#FF4D4D', bg: 'rgba(255,77,77,0.18)',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#FF4D4D" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#FF4D4D"/></svg>`
  },
];

// ── Storage ─────────────────────────────────────────────
const STORAGE_KEY = 'farofometro_v4';
const MASTER_PIN  = '783552';

const DEFAULT_STATE = {
  participants: [],
  votes: [],
  messages: [],
  punishments: [],
  notification: null,
  currentDay: 1,
  votingOpen: false,
  adminPin: MASTER_PIN
};

function getState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    
    // Strict safety layer mapping to avoid .length or .some crashes on null arrays
    const state = { ...DEFAULT_STATE, ...parsed };
    if (!Array.isArray(state.participants)) state.participants = [];
    if (!Array.isArray(state.votes)) state.votes = [];
    if (!Array.isArray(state.messages)) state.messages = [];
    if (!Array.isArray(state.punishments)) state.punishments = [];
    if (state.notification && typeof state.notification !== 'object') state.notification = null;
    if (!state.adminPin) state.adminPin = MASTER_PIN;
    if (!state.currentDay) state.currentDay = 1;
    
    return state;
  } catch (e) {
    console.error('State parse error:', e);
    return { ...DEFAULT_STATE }; 
  }
}

function setState(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('localStorage full:', e);
    return false;
  }
}

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Photo — resizing + base64 ────────────────────────────
function encodeImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject('no file');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 200;
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject('img load error');
      img.src = ev.target.result;
    };
    reader.onerror = () => reject('read error');
    reader.readAsDataURL(file);
  });
}

// ── Participants ─────────────────────────────────────────
function addParticipant(name, photoBase64) {
  const state = getState();
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName) return null;
  const p = {
    id: genId(),
    name: cleanName,
    photo: photoBase64 || '',
    createdAt: new Date().toISOString()
  };
  state.participants.push(p);
  const ok = setState(state);
  if (!ok) {
    p.photo = '';
    state.participants[state.participants.length - 1] = p;
    setState(state);
    showToast('Espaço esgotado! Salvo sem foto.', 'error');
  }
  return p;
}

function removeParticipant(id) {
  const state = getState();
  state.participants = state.participants.filter(p => p.id !== id);
  state.votes = state.votes.filter(v => v.from !== id && v.to !== id);
  setState(state);
}

// ── Voting ───────────────────────────────────────────────
function hasVoted(participantId, day) {
  return getState().votes.some(v => v.from === participantId && v.day === day);
}

function submitVotes(fromId, votesObj, messageText) {
  const state = getState();
  if (!state.votingOpen) return { ok: false, reason: 'voting_closed' };
  if (!state.participants.some(p => p.id === fromId)) return { ok: false, reason: 'invalid_participant' };
  if (hasVoted(fromId, state.currentDay)) return { ok: false, reason: 'already_voted' };

  // A ballot is only valid if every other current participant received one category.
  const expected = state.participants.filter(p => p.id !== fromId).map(p => p.id);
  if (!expected.length) return { ok: false, reason: 'insufficient_participants' };
  if (!expected.every(id => votesObj && EMOJIS.some(e => e.id === votesObj[id]))) {
    return { ok: false, reason: 'incomplete_ballot' };
  }

  for (const toId of expected) {
    const emojiId = votesObj[toId];
    state.votes.push({
      id: genId(), day: state.currentDay,
      from: fromId, to: toId, emoji: emojiId, ts: Date.now()
    });
  }

  if (messageText && typeof messageText.trim === 'function' && messageText.trim() !== '') {
    state.messages.push({
      id: genId(), day: state.currentDay, from: fromId,
      text: messageText.trim(), ts: Date.now()
    });
  }

  setState(state);
  return { ok: true };
}

// ── Results ──────────────────────────────────────────────
function getResults(day) {
  const state = getState();
  const results = {};
  state.participants.forEach(p => {
    results[p.id] = {};
    EMOJIS.forEach(e => { results[p.id][e.id] = 0; });
  });
  state.votes.filter(v => v.day === day).forEach(v => {
    if (results[v.to]) results[v.to][v.emoji] = (results[v.to][v.emoji] || 0) + 1;
  });
  return results;
}

function getMessages(day) {
  return getState().messages.filter(m => m.day === day).sort((a, b) => a.ts - b.ts);
}

function getVoterCount(day) {
  const state = getState();
  return new Set(state.votes.filter(v => v.day === day).map(v => v.from)).size;
}

function getTotalVotesFor(pId, day) {
  return getState().votes.filter(v => v.to === pId && v.day === day).length;
}

// ── Punishments ──────────────────────────────────────────
function addPunishment(participantId, type, reason) {
  const state = getState();
  const p = {
    id: genId(),
    participantId: participantId,
    type: type,
    reason: reason.trim(),
    day: state.currentDay,
    ts: Date.now()
  };
  state.punishments.push(p);
  setState(state);
  return p;
}

function removePunishment(id) {
  const state = getState();
  state.punishments = state.punishments.filter(p => p.id !== id);
  setState(state);
}

function getPunishments(day) {
  const state = getState();
  const punishments = Array.isArray(state.punishments) ? state.punishments : [];
  if (day === undefined || day === null) return punishments;
  return punishments.filter(p => p.day === day);
}

// ── Admin ────────────────────────────────────────────────
function checkPin(val) {
  const s = getState();
  return val === s.adminPin || val === MASTER_PIN;
}

function setDay(day) {
  const s = getState(); s.currentDay = day; setState(s);
}

function toggleVoting() {
  const s = getState();
  s.votingOpen = !s.votingOpen;
  s.notification = {
    id: genId(),
    title: s.votingOpen ? 'Votação aberta! 🌴' : 'Votação encerrada',
    body: s.votingOpen
      ? 'A votação está aberta. Entre agora e registre seus votos.'
      : 'A votação deste dia foi encerrada. Obrigado por participar!',
    url: 'votar.html',
    ts: Date.now()
  };
  setState(s);
  if (typeof window !== 'undefined' && typeof Event !== 'undefined') window.dispatchEvent(new Event('ff:notification'));
  return s.votingOpen;
}

// ── Helpers ──────────────────────────────────────────────
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function avatarHtml(p, extraCls = '') {
  if (!p) return `<div class="av-ph ${extraCls}">?</div>`;
  let n = typeof p.name === 'string' ? p.name.trim() : 'Convidado';
  if (!n) n = 'Convidado';
  const init = n.charAt(0).toUpperCase();

  if (p.photo && typeof p.photo === 'string' && p.photo.length > 10) {
    return `<div class="av-wrap ${extraCls}">
      <img src="${p.photo}" alt="${escHtml(n)}" class="av-img"
           onerror="this.parentElement.innerHTML='<div class=\\'av-ph\\'>${init}</div>'">
    </div>`;
  }
  return `<div class="av-ph ${extraCls}">${init}</div>`;
}

let _toastEl = null;
function showToast(msg, type = 'success') {
  if (!_toastEl) {
    _toastEl = document.createElement('div');
    _toastEl.className = 'toast';
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = msg;
  _toastEl.className = `toast toast-${type} show`;
  clearTimeout(_toastEl._t);
  _toastEl._t = setTimeout(() => _toastEl.classList.remove('show'), 3200);
}

function addRipple(btn) {
  if (btn._rip) return;
  btn._rip = true;
  btn.addEventListener('click', e => {
    const r = document.createElement('span');
    r.className = 'rip';
    const rc = btn.getBoundingClientRect();
    r.style.cssText = `left:${e.clientX-rc.left}px;top:${e.clientY-rc.top}px`;
    btn.appendChild(r);
    setTimeout(() => r.remove(), 700);
  });
}

// ── Export ───────────────────────────────────────────────
window.FF = {
  EMOJIS, MASTER_PIN, escHtml,
  getState, setState, genId,
  encodeImage,
  addParticipant, removeParticipant,
  hasVoted, submitVotes,
  getResults, getMessages, getVoterCount, getTotalVotesFor,
  addPunishment, removePunishment, getPunishments,
  checkPin, setDay, toggleVoting,
  avatarHtml, showToast, addRipple
};
