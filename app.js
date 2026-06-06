/* KvizBI repaired app.js */
const SUPABASE_URL = 'https://ohihvtjofkiqlafxthxn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaWh2dGpvZmtpcWxhZnh0aHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDA1MDAsImV4cCI6MjA5NjI3NjUwMH0.0sYr7zrGqzU82g6oQ2fZ60w-801w6jDXXMHnzKeKmn8';

if (!window.supabase || !window.supabase.createClient) {
  console.error('Supabase client library is not loaded');
}

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const QUESTIONS = [
  { text: 'Какое полное название у нашего направления?', options: ['Бизнес-информатика (Бизнес в цифровой экономике)', 'Бизнес-информатика (Электронный бизнес)', 'Воздуханство в цифровой экономике', 'Международный менеджмент'], correct: 0 },
  { text: 'Как зовут преподавателя по УЖЦИС (ударение)?', options: ['НАгучев МадИн МахмУдович', 'НАгучев МахмудИн МахарАгович', 'НагУчев МадИн МахмУдович', 'МАгович НадИн МахмУдович'], correct: 2 },
  { text: 'Какой код нашего направления?', options: ['38.03.05', '38.04.05', '38.03.07', '39.03.05'], correct: 0 },
  { text: 'Кто на первом курсе у нас вел общую экономическую теорию?', options: ['Сидоров В.А', 'Кузнецова Е.Л.', 'Кузьмина Э.В', 'Нагучев М.М'], correct: 1 },
  { text: 'Как зовут заведующего нашей кафедры?', options: ['Кузнецова Е.Л.', 'Сидоров В.А', 'Сайбель Н.Ю', 'Геворкян С.М'], correct: 1 },
  { text: 'На какой кафедре мы учимся?', options: ['Кафедра экономического анализа, статистики и финансов', 'Кафедра прикладной экономики и управления персоналом', 'Кафедра теоретической экономики', 'Кафедра маркетинга и торгового дела'], correct: 2 },
  { text: 'В каком году мы начали обучение?', options: ['2022', '2023', '2024', '2021'], correct: 1 },
  { text: 'Сколько лет нужно учиться на бакалавриате нашей специальности?', options: ['4 года', '5 лет', '6 лет', '3 года'], correct: 0 },
  { text: 'Кто вел у нас Blender?', options: ['Хаконов Ш.М', 'Петров С.И', 'Кузьмина Э.В', 'Нагучев М.М'], correct: 0 },
  { text: 'Кем мы можем работать по специальности?', options: ['Пожарным', 'Токарем', 'Учителем', 'Бизнес-аналитиком'], correct: 3 }
];

const QUESTION_TIME = 60;
const SHOW_RESULT_SECS = 5;

let currentUser = null;
let currentProfile = null;
let currentRoom = null;
let isHost = false;
let roomPlayers = [];
let realtimeSub = null;
let roomStateSub = null;
let isTransitioning = false;

let gameState = {
  questionIndex: 0,
  score: 0,
  answers: [],
  answered: false,
  timerInterval: null,
  timeLeft: QUESTION_TIME,
  roundDeadline: null,
  roundStartedAt: null
};

function el(id) { return document.getElementById(id); }
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const node = el(id);
  if (node) node.classList.add('active');
}
function showToast(msg, duration = 2800) {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
function avatarLetter(name) { return (name || '?')[0].toUpperCase(); }
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function clearTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}
function resetRoomState() {
  clearTimer();
  currentRoom = null;
  isHost = false;
  roomPlayers = [];
  isTransitioning = false;
  unsubscribeRoom();
}

const themeToggle = el('themeToggle');
const themeIcon = document.querySelector('.theme-icon');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☽' : '☀';
  try { localStorage.setItem('kvizbi-theme', theme); } catch {}
}
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}
try {
  applyTheme(localStorage.getItem('kvizbi-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
} catch { applyTheme('light'); }

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    el(tab === 'login' ? 'tabLogin' : 'tabRegister')?.classList.add('active');
    const authMessage = el('authMessage');
    if (authMessage) authMessage.textContent = '';
  });
});
function setAuthMsg(msg, type = 'error') {
  const node = el('authMessage');
  if (!node) return;
  node.textContent = msg;
  node.className = 'auth-message ' + type;
}
function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  const span = btn.querySelector('span');
  if (span) span.textContent = loading ? 'Загрузка…' : btn.dataset.label;
}
['loginBtn', 'registerBtn'].forEach(id => {
  const btn = el(id);
  if (btn) btn.dataset.label = btn.querySelector('span')?.textContent || btn.textContent.trim();
});

el('registerBtn')?.addEventListener('click', async () => {
  const name = el('regName')?.value.trim();
  const group = el('regGroup')?.value.trim();
  const email = el('regEmail')?.value.trim();
  const pass = el('regPassword')?.value;
  if (!name || !email || !pass) return setAuthMsg('Заполните все поля');
  if (pass.length < 6) return setAuthMsg('Пароль минимум 6 символов');
  const btn = el('registerBtn');
  setBtnLoading(btn, true);
  const { data, error } = await db.auth.signUp({ email, password: pass, options: { data: { name, group } } });
  setBtnLoading(btn, false);
  if (error) return setAuthMsg(error.message);
  if (data.user) {
    await db.from('profiles').upsert({ id: data.user.id, email, name, group_name: group, created_at: new Date().toISOString() });
    setAuthMsg('Аккаунт создан! Проверьте почту и войдите.', 'success');
  }
});

el('loginBtn')?.addEventListener('click', async () => {
  const email = el('loginEmail')?.value.trim();
  const pass = el('loginPassword')?.value;
  if (!email || !pass) return setAuthMsg('Введите email и пароль');
  const btn = el('loginBtn');
  setBtnLoading(btn, true);
  const { data, error } = await db.auth.signInWithPassword({ email, password: pass });
  setBtnLoading(btn, false);
  if (error) return setAuthMsg(error.message);
  if (data.user) await onLogin(data.user);
});

el('logoutBtn')?.addEventListener('click', async () => {
  await leaveRoomIfAny();
  await db.auth.signOut();
  currentUser = null;
  currentProfile = null;
  if (el('userPill')) el('userPill').style.display = 'none';
  showScreen('screenAuth');
});

async function onLogin(user) {
  currentUser = user;
  let { data: profile } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    const meta = user.user_metadata || {};
    profile = { id: user.id, email: user.email, name: meta.name || user.email.split('@')[0], group_name: meta.group || '', created_at: user.created_at };
    await db.from('profiles').upsert(profile);
  }
  currentProfile = profile;
  if (el('navUserName')) el('navUserName').textContent = profile.name;
  if (el('userPill')) el('userPill').style.display = 'flex';
  if (el('homeUserName')) el('homeUserName').textContent = profile.name;
  if (el('homeUserGroup')) el('homeUserGroup').textContent = profile.group_name || 'не указана';
  showScreen('screenHome');
}

(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) await onLogin(session.user);
})();

db.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user && (!currentUser || currentUser.id !== session.user.id)) await onLogin(session.user);
  if (event === 'SIGNED_OUT') {
    currentUser = null;
    currentProfile = null;
    resetRoomState();
    showScreen('screenAuth');
  }
});

el('createRoomBtn')?.addEventListener('click', async () => {
  if (!currentUser) return;
  if (el('homeMessage')) el('homeMessage').textContent = '';
  const code = genRoomCode();
  const { data: room, error } = await db.from('rooms').insert({
    code, host_id: currentUser.id, status: 'waiting', current_question: 0,
    question_started_at: null, question_deadline: null, reveal_until: null,
    created_at: new Date().toISOString()
  }).select().single();
  if (error) {
    if (el('homeMessage')) el('homeMessage').textContent = 'Ошибка создания комнаты: ' + error.message;
    return;
  }
  await joinRoomPlayers(room.id);
  currentRoom = room;
  isHost = true;
  await enterWaitingRoom();
});

el('joinRoomBtn')?.addEventListener('click', async () => {
  const code = el('joinRoomCode')?.value.trim().toUpperCase();
  if (!code) return;
  if (el('homeMessage')) el('homeMessage').textContent = '';
  const { data: room, error } = await db.from('rooms').select('*').eq('code', code).maybeSingle();
  if (error || !room) {
    if (el('homeMessage')) el('homeMessage').textContent = 'Комната не найдена.';
    return;
  }
  if (room.status !== 'waiting') {
    if (el('homeMessage')) el('homeMessage').textContent = 'Игра уже идёт или завершена.';
    return;
  }
  const { count, error: countError } = await db.from('room_players').select('*', { count: 'exact', head: true }).eq('room_id', room.id).is('left_at', null);
  if (countError) {
    if (el('homeMessage')) el('homeMessage').textContent = 'Ошибка проверки комнаты.';
    return;
  }
  if ((count || 0) >= 4) {
    if (el('homeMessage')) el('homeMessage').textContent = 'Комната полна (максимум 4 игрока).';
    return;
  }
  await joinRoomPlayers(room.id);
  currentRoom = room;
  isHost = room.host_id === currentUser.id;
  await enterWaitingRoom();
});

async function joinRoomPlayers(roomId) {
  await db.from('room_players').upsert({
    room_id: roomId, user_id: currentUser.id, name: currentProfile.name,
    group_name: currentProfile.group_name || '', score: 0, joined_at: new Date().toISOString(),
    left_at: null, last_answer_question: null, last_answer_selected: null, last_answer_correct: null, last_answer_at: null
  }, { onConflict: 'room_id,user_id' });
}

async function enterWaitingRoom() {
  showScreen('screenRoom');
  if (el('roomCode')) el('roomCode').textContent = currentRoom.code;
  const copyBtn = el('copyCodeBtn');
  if (copyBtn) {
    copyBtn.onclick = () => navigator.clipboard.writeText(currentRoom.code).then(() => showToast('Код скопирован!'));
  }
  await loadRoomPlayers();
  subscribeRoom();
}

async function loadRoomPlayers() {
  const { data } = await db.from('room_players').select('*').eq('room_id', currentRoom.id).is('left_at', null).order('joined_at');
  roomPlayers = data || [];
  renderPlayers();
  updateRoomUI();
}

function renderPlayers() {
  const list = el('playersList');
  if (!list) return;
  list.innerHTML = '';
  roomPlayers.forEach(p => {
    const isMe = p.user_id === currentUser.id;
    const isH = currentRoom && p.user_id === currentRoom.host_id;
    const row = document.createElement('div');
    row.className = 'player-row' + (isMe ? ' me' : '');
    row.innerHTML = `
      <div class="player-avatar">${avatarLetter(p.name)}</div>
      <div class="player-info">
        <div class="player-name">${escHtml(p.name)}</div>
        <div class="player-meta">${escHtml(p.group_name || '')}</div>
      </div>
      <div class="player-badges">${isH ? '<span class="badge badge-host">Хост</span>' : ''}${isMe ? '<span class="badge badge-you">Вы</span>' : ''}</div>`;
    list.appendChild(row);
  });
  if (el('playerCount')) el('playerCount').textContent = roomPlayers.length;
}

function updateRoomUI() {
  const status = currentRoom?.status || 'waiting';
  const badge = el('roomStatusBadge');
  const hint = el('roomHint');
  const startBtn = el('startGameBtn');
  if (badge) {
    badge.textContent = ({ waiting: 'Ожидание', playing: 'Играем', finished: 'Завершено' }[status] || status);
    badge.className = 'room-status-badge' + (status === 'playing' ? ' playing' : status === 'waiting' && roomPlayers.length >= 2 ? ' ready' : '');
  }
  if (isHost && status === 'waiting') {
    if (startBtn) {
      startBtn.style.display = 'block';
      startBtn.disabled = roomPlayers.length < 2 || roomPlayers.length > 4;
    }
    if (hint) hint.textContent = roomPlayers.length < 2 ? 'Ожидаем игроков (минимум 2)…' : 'Можно начинать!';
  } else {
    if (startBtn) startBtn.style.display = 'none';
    if (hint) hint.textContent = status === 'waiting' ? 'Ожидаем, когда хост начнёт игру…' : '';
  }
}

function subscribeRoom() {
  unsubscribeRoom();
  realtimeSub = db.channel('room-' + currentRoom.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${currentRoom.id}` }, async payload => {
      if (!payload.new) return;
      currentRoom = payload.new;
      isHost = currentRoom.host_id === currentUser.id;
      if (currentRoom.status === 'playing') {
        await loadRoomPlayers();
        showScreen('screenGame');
        beginQuestionFromRoom();
      } else if (currentRoom.status === 'finished') {
        clearTimer();
        await finishFromDatabase();
      } else {
        updateRoomUI();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${currentRoom.id}` }, async () => {
      await loadRoomPlayers();
      if (currentRoom?.status === 'playing') await maybeAdvanceAsHost();
    })
    .subscribe();
}

function unsubscribeRoom() {
  if (realtimeSub) {
    db.removeChannel(realtimeSub);
    realtimeSub = null;
  }
  if (roomStateSub) {
    db.removeChannel(roomStateSub);
    roomStateSub = null;
  }
}

el('startGameBtn')?.addEventListener('click', async () => {
  if (!isHost || roomPlayers.length < 2 || roomPlayers.length > 4) return;
  const now = new Date();
  const deadline = new Date(now.getTime() + QUESTION_TIME * 1000);
  const { error } = await db.from('rooms').update({
    status: 'playing', current_question: 0,
    started_at: now.toISOString(), question_started_at: now.toISOString(),
    question_deadline: deadline.toISOString(), reveal_until: null
  }).eq('id', currentRoom.id);
  if (error && el('roomMessage')) el('roomMessage').textContent = 'Ошибка: ' + error.message;
});

el('leaveRoomBtn')?.addEventListener('click', async () => {
  await leaveRoomIfAny();
  showScreen('screenHome');
});

async function leaveRoomIfAny() {
  if (!currentRoom || !currentUser) return;
  clearTimer();
  unsubscribeRoom();
  await db.from('room_players').update({ left_at: new Date().toISOString() }).eq('room_id', currentRoom.id).eq('user_id', currentUser.id);
  if (currentRoom.host_id === currentUser.id) {
    const remaining = roomPlayers.filter(p => p.user_id !== currentUser.id);
    if (remaining.length > 0) {
      await db.from('rooms').update({ host_id: remaining[0].user_id }).eq('id', currentRoom.id);
    } else {
      await db.from('rooms').update({ status: 'finished' }).eq('id', currentRoom.id);
    }
  }
  resetRoomState();
}

function beginQuestionFromRoom() {
  if (!currentRoom) return;
  const qIndex = Number(currentRoom.current_question || 0);
  if (qIndex >= QUESTIONS.length) return finishFromDatabase();
  gameState.questionIndex = qIndex;
  gameState.answered = false;
  gameState.roundStartedAt = currentRoom.question_started_at;
  gameState.roundDeadline = currentRoom.question_deadline;
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[gameState.questionIndex];
  if (!q) return finishFromDatabase();
  if (el('questionNum')) el('questionNum').textContent = gameState.questionIndex + 1;
  if (el('questionTotal')) el('questionTotal').textContent = QUESTIONS.length;
  if (el('questionText')) el('questionText').textContent = q.text;
  if (el('liveScore')) el('liveScore').textContent = gameState.score;
  if (el('answerFeedback')) el('answerFeedback').style.display = 'none';
  if (el('waitingOthers')) el('waitingOthers').style.display = 'none';
  const grid = el('optionsGrid');
  if (grid) {
    grid.innerHTML = '';
    const letters = ['А', 'Б', 'В', 'Г'];
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `<span class="option-letter">${letters[i]}</span>${escHtml(opt)}`;
      btn.addEventListener('click', () => onAnswer(i));
      grid.appendChild(btn);
    });
  }
  startTimerFromDeadline();
}

function startTimerFromDeadline() {
  clearTimer();
  const deadline = currentRoom?.question_deadline ? new Date(currentRoom.question_deadline).getTime() : Date.now() + QUESTION_TIME * 1000;
  const tick = () => {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    gameState.timeLeft = seconds;
    updateTimerUI(seconds, QUESTION_TIME);
    if (seconds <= 0) {
      clearTimer();
      onTimeout();
    }
  };
  tick();
  gameState.timerInterval = setInterval(tick, 250);
}

function updateTimerUI(timeLeft, total) {
  if (el('timerText')) el('timerText').textContent = timeLeft;
  const circle = el('timerCircle');
  if (!circle) return;
  const circumference = 150.8;
  const fraction = Math.max(0, Math.min(1, timeLeft / total));
  circle.style.strokeDashoffset = circumference * (1 - fraction);
  circle.classList.remove('warning', 'danger');
  if (timeLeft <= 10) circle.classList.add('danger');
  else if (timeLeft <= 20) circle.classList.add('warning');
}

async function onAnswer(selectedIndex) {
  if (gameState.answered || !currentRoom) return;
  gameState.answered = true;
  clearTimer();
  const q = QUESTIONS[gameState.questionIndex];
  const correct = selectedIndex === q.correct;
  if (correct) gameState.score++;
  gameState.answers.push({ questionIndex: gameState.questionIndex, selectedIndex, correct, timeLeft: gameState.timeLeft });
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add('correct');
    if (i === selectedIndex && !correct) btn.classList.add('wrong');
  });
  const fb = el('answerFeedback');
  if (fb) {
    fb.style.display = 'flex';
    fb.className = 'answer-feedback ' + (correct ? 'correct' : 'wrong');
  }
  if (el('feedbackIcon')) el('feedbackIcon').textContent = correct ? '✓' : '✗';
  if (el('feedbackText')) el('feedbackText').textContent = correct ? 'Правильно! +1 балл' : 'Неверно.';
  if (el('liveScore')) el('liveScore').textContent = gameState.score;
  if (el('waitingOthers')) el('waitingOthers').style.display = 'block';
  await db.from('room_players').update({
    score: gameState.score,
    last_answer_question: gameState.questionIndex,
    last_answer_selected: selectedIndex,
    last_answer_correct: correct,
    last_answer_at: new Date().toISOString()
  }).eq('room_id', currentRoom.id).eq('user_id', currentUser.id);
  await maybeAdvanceAsHost();
}

async function onTimeout() {
  if (gameState.answered || !currentRoom) return;
  gameState.answered = true;
  const q = QUESTIONS[gameState.questionIndex];
  gameState.answers.push({ questionIndex: gameState.questionIndex, selectedIndex: -1, correct: false, timeLeft: 0 });
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add('correct');
  });
  const fb = el('answerFeedback');
  if (fb) {
    fb.style.display = 'flex';
    fb.className = 'answer-feedback timeout';
  }
  if (el('feedbackIcon')) el('feedbackIcon').textContent = '⏱';
  if (el('feedbackText')) el('feedbackText').textContent = 'Время вышло!';
  if (el('waitingOthers')) el('waitingOthers').style.display = 'block';
  await db.from('room_players').update({
    score: gameState.score,
    last_answer_question: gameState.questionIndex,
    last_answer_selected: -1,
    last_answer_correct: false,
    last_answer_at: new Date().toISOString()
  }).eq('room_id', currentRoom.id).eq('user_id', currentUser.id);
  await maybeAdvanceAsHost();
}

async function maybeAdvanceAsHost() {
  if (!isHost || !currentRoom || isTransitioning) return;
  const currentIndex = Number(currentRoom.current_question || 0);
  const deadlinePassed = currentRoom.question_deadline ? new Date(currentRoom.question_deadline).getTime() <= Date.now() : false;
  const { data: activePlayers } = await db.from('room_players').select('*').eq('room_id', currentRoom.id).is('left_at', null);
  const everyoneAnswered = (activePlayers || []).length > 0 && activePlayers.every(p => p.last_answer_question === currentIndex);
  if (!everyoneAnswered && !deadlinePassed) return;
  isTransitioning = true;
  const revealUntil = new Date(Date.now() + SHOW_RESULT_SECS * 1000).toISOString();
  await db.from('rooms').update({ reveal_until: revealUntil }).eq('id', currentRoom.id);
  showRoundResult(QUESTIONS[currentIndex], activePlayers || []);
  setTimeout(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= QUESTIONS.length) {
      await db.from('rooms').update({ status: 'finished', reveal_until: null }).eq('id', currentRoom.id);
    } else {
      const now = new Date();
      const deadline = new Date(now.getTime() + QUESTION_TIME * 1000);
      await db.from('room_players').update({ last_answer_question: null, last_answer_selected: null, last_answer_correct: null, last_answer_at: null }).eq('room_id', currentRoom.id).is('left_at', null);
      await db.from('rooms').update({
        current_question: nextIndex,
        question_started_at: now.toISOString(),
        question_deadline: deadline.toISOString(),
        reveal_until: null
      }).eq('id', currentRoom.id);
    }
    isTransitioning = false;
  }, SHOW_RESULT_SECS * 1000);
}

function showRoundResult(q, players = []) {
  clearTimer();
  if (el('revealAnswer')) el('revealAnswer').textContent = q.options[q.correct];
  const sb = el('roundScoreboard');
  if (sb) {
    sb.innerHTML = '';
    const sorted = [...players].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));
    sorted.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'sb-row' + (p.user_id === currentUser.id ? ' me' : '');
      row.innerHTML = `<div class="sb-rank">${i + 1}</div><div class="sb-name">${escHtml(p.name)}${p.user_id === currentUser.id ? ' <em style="font-size:.78rem;color:var(--text3)">(вы)</em>' : ''}</div><div class="sb-score">${p.score}</div>`;
      sb.appendChild(row);
    });
  }
  showScreen('screenRoundResult');
  let cnt = SHOW_RESULT_SECS;
  if (el('nextCountdown')) el('nextCountdown').textContent = cnt;
  const iv = setInterval(() => {
    cnt--;
    if (el('nextCountdown')) el('nextCountdown').textContent = Math.max(0, cnt);
    if (cnt <= 0) clearInterval(iv);
  }, 1000);
}

async function finishFromDatabase() {
  const attempt = await saveAttempt();
  showFinalResult(attempt);
}

async function saveAttempt() {
  if (!currentUser || !currentRoom) return null;
  await db.from('room_players').update({ score: gameState.score }).eq('room_id', currentRoom.id).eq('user_id', currentUser.id);
  const { data: players } = await db.from('room_players').select('*').eq('room_id', currentRoom.id).order('score', { ascending: false }).order('joined_at', { ascending: true });
  const place = (players || []).findIndex(p => p.user_id === currentUser.id) + 1;
  const attemptData = {
    user_id: currentUser.id,
    user_name: currentProfile.name,
    user_email: currentProfile.email,
    room_id: currentRoom.id,
    room_code: currentRoom.code,
    score: gameState.score,
    max_score: QUESTIONS.length,
    place: place || 1,
    answers: gameState.answers,
    played_at: new Date().toISOString()
  };
  const { data: existing } = await db.from('quiz_attempts').select('id').eq('room_id', currentRoom.id).eq('user_id', currentUser.id).maybeSingle();
  if (existing?.id) {
    await db.from('quiz_attempts').update(attemptData).eq('id', existing.id);
  } else {
    await db.from('quiz_attempts').insert(attemptData);
  }
  return { ...attemptData, players: players || [] };
}

function showFinalResult(attempt) {
  showScreen('screenFinalResult');
  const players = attempt?.players?.length ? attempt.players : [{ user_id: currentUser.id, name: currentProfile.name, score: gameState.score, group_name: currentProfile.group_name }];
  const podium = el('finalPodium');
  if (podium) {
    podium.innerHTML = '';
    const sorted = [...players].sort((a, b) => b.score - a.score || a.joined_at?.localeCompare?.(b.joined_at || '') || 0);
    const podiumOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
    const placeNums = { 0: 2, 1: 1, 2: 3 };
    podiumOrder.forEach((p, idx) => {
      const place = placeNums[idx];
      const div = document.createElement('div');
      div.className = `podium-item place-${place}`;
      div.innerHTML = `<div class="podium-avatar">${avatarLetter(p.name)}</div><div class="podium-name">${escHtml(p.name)}</div><div class="podium-score">${p.score} очк.</div><div class="podium-block">#${place}</div>`;
      podium.appendChild(div);
    });
  }
  const tbody = el('finalTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    [...players].sort((a, b) => b.score - a.score || a.joined_at?.localeCompare?.(b.joined_at || '') || 0).forEach((p, i) => {
      const tr = document.createElement('tr');
      if (p.user_id === currentUser.id) tr.classList.add('me');
      tr.innerHTML = `<td>${i + 1}</td><td>${escHtml(p.name)}</td><td>${escHtml(p.group_name || '—')}</td><td><strong>${p.score}</strong></td>`;
      tbody.appendChild(tr);
    });
  }
}

el('backHomeFromFinal')?.addEventListener('click', () => {
  resetRoomState();
  showScreen('screenHome');
});

el('goResultsBtn')?.addEventListener('click', () => loadMyResults());
el('backHomeFromResults')?.addEventListener('click', () => showScreen('screenHome'));

async function loadMyResults() {
  showScreen('screenMyResults');
  const list = el('myResultsList');
  if (!list) return;
  list.innerHTML = '<div class="loading-spinner">Загрузка…</div>';
  const { data, error } = await db.from('quiz_attempts').select('*').eq('user_id', currentUser.id).order('played_at', { ascending: false });
  if (error || !data?.length) {
    list.innerHTML = '<div class="no-results">Вы ещё не сыграли ни одной игры</div>';
    return;
  }
  list.innerHTML = '';
  data.forEach(attempt => {
    const card = document.createElement('div');
    card.className = 'result-card';
    const placeClass = attempt.place === 1 ? 'place-1-badge' : attempt.place === 2 ? 'place-2-badge' : attempt.place === 3 ? 'place-3-badge' : 'place-other';
    card.innerHTML = `<div class="result-card-header"><span class="result-room">Комната ${escHtml(attempt.room_code)}</span><span class="result-date">${formatDate(attempt.played_at)}</span></div><div class="result-meta"><span class="result-stat">Очки: <strong>${attempt.score}/${attempt.max_score}</strong></span><span class="result-stat">Место: <span class="result-place-badge ${placeClass}">#${attempt.place}</span></span></div>`;
    list.appendChild(card);
  });
}
