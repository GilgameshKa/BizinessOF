/* ═══════════════════════════════════════════
   КвизБИ — app.js
   Supabase Auth + Database + Realtime
═══════════════════════════════════════════ */

const SUPABASE_URL = 'https://ohihvtjofkiqlafxthxn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaWh2dGpvZmtpcWxhZnh0aHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDA1MDAsImV4cCI6MjA5NjI3NjUwMH0.0sYr7zrGqzU82g6oQ2fZ60w-801w6jDXXMHnzKeKmn8';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const QUESTIONS = [
  {
    text: 'Какое полное название у нашего направления?',
    options: [
      'Бизнес-информатика (Бизнес в цифровой экономике)',
      'Бизнес-информатика (Электронный бизнес)',
      'Воздуханство в цифровой экономике',
      'Международный менеджмент'
    ],
    correct: 0
  },
  {
    text: 'Как зовут преподавателя по УЖЦИС (ударение)?',
    options: [
      'НАгучев МадИн МахмУдович',
      'НАгучев МахмудИн МахарАгович',
      'НагУчев МадИн МахмУдович',
      'МАгович НадИн МахмУдович'
    ],
    correct: 2
  },
  {
    text: 'Какой код нашего направления?',
    options: ['38.03.05', '38.04.05', '38.03.07', '39.03.05'],
    correct: 0
  },
  {
    text: 'Кто на первом курсе у нас вел общую экономическую теорию?',
    options: ['Сидоров В.А', 'Кузнецова Е.Л.', 'Кузьмина Э.В', 'Нагучев М.М'],
    correct: 1
  },
  {
    text: 'Как зовут заведующего нашей кафедры?',
    options: ['Кузнецова Е.Л.', 'Сидоров В.А', 'Сайбель Н.Ю', 'Геворкян С.М'],
    correct: 1
  },
  {
    text: 'На какой кафедре мы учимся?',
    options: [
      'Кафедра экономического анализа, статистики и финансов',
      'Кафедра прикладной экономики и управления персоналом',
      'Кафедра теоретической экономики',
      'Кафедра маркетинга и торгового дела'
    ],
    correct: 2
  },
  {
    text: 'В каком году мы начали обучение?',
    options: ['2022', '2023', '2024', '2021'],
    correct: 1
  },
  {
    text: 'Сколько лет нужно учиться на бакалавриате нашей специальности?',
    options: ['4 года', '5 лет', '6 лет', '3 года'],
    correct: 0
  },
  {
    text: 'Кто вел у нас Blender?',
    options: ['Хаконов Ш.М', 'Петров С.И', 'Кузьмина Э.В', 'Нагучев М.М'],
    correct: 0
  },
  {
    text: 'Кем мы можем работать по специальности?',
    options: ['Пожарным', 'Токарем', 'Учителем', 'Бизнес-аналитиком'],
    correct: 3
  }
];

const QUESTION_TIME = 60;
const SHOW_RESULT_SECS = 5;

let currentUser = null;
let currentProfile = null;
let currentRoom = null;
let isHost = false;
let roomPlayers = [];
let realtimeSub = null;
let gameSyncSub = null;

let gameState = {
  questionIndex: 0,
  score: 0,
  answers: [],
  answered: false,
  timerInterval: null,
  timeLeft: QUESTION_TIME
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function avatarLetter(name) {
  return (name || '?')[0].toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.theme-icon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☽' : '☀';
  localStorage.setItem('kvizbi-theme', theme);
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}
applyTheme(localStorage.getItem('kvizbi-theme') || 'light');

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tab === 'login' ? 'tabLogin' : 'tabRegister').classList.add('active');
    document.getElementById('authMessage').textContent = '';
  });
});

function setAuthMsg(msg, type = 'error') {
  const el = document.getElementById('authMessage');
  if (!el) return;
  el.textContent = msg;
  el.className = 'auth-message ' + type;
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  const span = btn.querySelector('span');
  if (span) span.textContent = loading ? 'Загрузка…' : btn.dataset.label;
}

['loginBtn', 'registerBtn'].forEach(id => {
  const el = document.getElementById(id);
  if (el?.querySelector('span')) el.dataset.label = el.querySelector('span').textContent;
});

document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('regName').value.trim();
  const group = document.getElementById('regGroup').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPassword').value;

  if (!name || !email || !pass) return setAuthMsg('Заполните все поля');
  if (pass.length < 6) return setAuthMsg('Пароль минимум 6 символов');

  const btn = document.getElementById('registerBtn');
  setBtnLoading(btn, true);

  const { data, error } = await db.auth.signUp({
    email,
    password: pass,
    options: { data: { name, group } }
  });

  setBtnLoading(btn, false);

  if (error) return setAuthMsg(error.message);
  if (data.user) {
    await db.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      groupname: group,
      createdat: new Date().toISOString()
    });
    setAuthMsg('Аккаунт создан! Теперь войдите.', 'success');
  }
});

document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;

  if (!email || !pass) return setAuthMsg('Введите email и пароль');

  const btn = document.getElementById('loginBtn');
  setBtnLoading(btn, true);

  const { data, error } = await db.auth.signInWithPassword({ email, password: pass });

  setBtnLoading(btn, false);

  if (error) return setAuthMsg(error.message);
  if (data.user) await onLogin(data.user);
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await leaveRoomIfAny();
  await db.auth.signOut();
  currentUser = null;
  currentProfile = null;
  const userPill = document.getElementById('userPill');
  if (userPill) userPill.style.display = 'none';
  showScreen('screenAuth');
});

async function onLogin(user) {
  currentUser = user;

  let { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();

  if (!profile) {
    const meta = user.user_metadata || {};
    profile = {
      id: user.id,
      email: user.email,
      name: meta.name || user.email.split('@')[0],
      groupname: meta.group || '',
      createdat: user.created_at
    };
    await db.from('profiles').upsert(profile);
  }

  currentProfile = profile;

  const navUserName = document.getElementById('navUserName');
  const userPill = document.getElementById('userPill');
  const homeUserName = document.getElementById('homeUserName');
  const homeUserGroup = document.getElementById('homeUserGroup');

  if (navUserName) navUserName.textContent = profile.name;
  if (userPill) userPill.style.display = 'flex';
  if (homeUserName) homeUserName.textContent = profile.name;
  if (homeUserGroup) homeUserGroup.textContent = profile.groupname || 'не указана';

  showScreen('screenHome');
}

(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) await onLogin(session.user);
})();

document.getElementById('createRoomBtn')?.addEventListener('click', async () => {
  if (!currentUser) return;
  document.getElementById('homeMessage').textContent = '';

  const code = genRoomCode();

  const { data: room, error } = await db.from('rooms').insert({
    code,
    hostid: currentUser.id,
    status: 'waiting',
    currentquestion: 0,
    createdat: new Date().toISOString()
  }).select().single();

  if (error) {
    document.getElementById('homeMessage').textContent = 'Ошибка создания комнаты: ' + error.message;
    return;
  }

  currentRoom = room;
  isHost = true;
  await joinRoomPlayers(room.id);
  await enterWaitingRoom();
});

document.getElementById('joinRoomBtn')?.addEventListener('click', async () => {
  const code = document.getElementById('joinRoomCode').value.trim().toUpperCase();
  if (!code) return;
  document.getElementById('homeMessage').textContent = '';

  const { data: room, error } = await db.from('rooms').select('*').eq('code', code).single();

  if (error || !room) {
    document.getElementById('homeMessage').textContent = 'Комната не найдена.';
    return;
  }

  if (room.status !== 'waiting') {
    document.getElementById('homeMessage').textContent = 'Игра уже идет или завершена.';
    return;
  }

  const { count } = await db.from('roomplayers')
    .select('*', { count: 'exact', head: true })
    .eq('roomid', room.id)
    .is('leftat', null);

  if ((count || 0) >= 4) {
    document.getElementById('homeMessage').textContent = 'Комната полна (максимум 4 игрока).';
    return;
  }

  currentRoom = room;
  isHost = room.hostid === currentUser.id;
  await joinRoomPlayers(room.id);
  await enterWaitingRoom();
});

async function joinRoomPlayers(roomId) {
  const { error } = await db.from('roomplayers').upsert({
    roomid: roomId,
    userid: currentUser.id,
    name: currentProfile.name,
    groupname: currentProfile.groupname || '',
    score: 0,
    joinedat: new Date().toISOString(),
    leftat: null
  }, { onConflict: 'roomid,userid' });

  if (error) showToast('Ошибка входа в комнату: ' + error.message, 4500);
}

async function enterWaitingRoom() {
  showScreen('screenRoom');
  document.getElementById('roomCode').textContent = currentRoom.code;

  const copyBtn = document.getElementById('copyCodeBtn');
  if (copyBtn && !copyBtn.dataset.bound) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(currentRoom.code).then(() => showToast('Код скопирован!'));
    });
    copyBtn.dataset.bound = '1';
  }

  await loadRoomPlayers();
  subscribeRoom();
}

async function loadRoomPlayers() {
  const { data, error } = await db.from('roomplayers')
    .select('*')
    .eq('roomid', currentRoom.id)
    .is('leftat', null)
    .order('joinedat', { ascending: true });

  if (error) {
    showToast('Ошибка загрузки игроков: ' + error.message, 4500);
    return;
  }

  roomPlayers = data || [];
  renderPlayers();
  updateRoomUI();
}

function renderPlayers() {
  const list = document.getElementById('playersList');
  list.innerHTML = '';

  roomPlayers.forEach(p => {
    const isMe = p.userid === currentUser.id;
    const isH = currentRoom && p.userid === currentRoom.hostid;

    const row = document.createElement('div');
    row.className = 'player-row' + (isMe ? ' me' : '');
    row.innerHTML = `
      <div class="player-avatar">${avatarLetter(p.name)}</div>
      <div class="player-info">
        <div class="player-name">${escHtml(p.name)}</div>
        <div class="player-meta">${escHtml(p.groupname || '')}</div>
      </div>
      <div class="player-badges">
        ${isH ? '<span class="badge badge-host">Хост</span>' : ''}
        ${isMe ? '<span class="badge badge-you">Вы</span>' : ''}
      </div>
    `;
    list.appendChild(row);
  });

  document.getElementById('playerCount').textContent = roomPlayers.length;
}

function updateRoomUI() {
  const status = currentRoom?.status || 'waiting';
  const badge = document.getElementById('roomStatusBadge');
  const hint = document.getElementById('roomHint');
  const startBtn = document.getElementById('startGameBtn');

  badge.textContent = ({ waiting: 'Ожидание', playing: 'Играем', finished: 'Завершено' })[status] || status;
  badge.className = 'room-status-badge' + (status === 'playing' ? ' playing' : status === 'waiting' && roomPlayers.length >= 2 ? ' ready' : '');

  if (isHost && status === 'waiting') {
    startBtn.style.display = 'block';
    startBtn.disabled = roomPlayers.length < 2;
    hint.textContent = roomPlayers.length < 2 ? 'Ожидаем игроков (минимум 2)…' : 'Можно начинать!';
  } else {
    startBtn.style.display = 'none';
    hint.textContent = status === 'waiting' ? 'Ожидаем, когда хост начнёт игру…' : '';
  }
}

function subscribeRoom() {
  unsubscribeRoom();

  realtimeSub = db.channel('room-' + currentRoom.id)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${currentRoom.id}`
    }, async payload => {
      if (!payload.new) return;

      currentRoom = payload.new;
      isHost = currentRoom.hostid === currentUser.id;

      if (currentRoom.status === 'playing') {
        await loadRoomPlayers();
        subscribeGameSync();
        startGame();
        return;
      }

      if (currentRoom.status === 'finished') {
        unsubscribeRoom();
        return;
      }

      updateRoomUI();
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'roomplayers',
      filter: `roomid=eq.${currentRoom.id}`
    }, async () => {
      await loadRoomPlayers();
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('room realtime subscribed');
      }
    });
}

function unsubscribeRoom() {
  if (realtimeSub) {
    db.removeChannel(realtimeSub);
    realtimeSub = null;
  }
  if (gameSyncSub) {
    db.removeChannel(gameSyncSub);
    gameSyncSub = null;
  }
}

document.getElementById('startGameBtn')?.addEventListener('click', async () => {
  if (!isHost || roomPlayers.length < 2) return;

  const { error } = await db.from('rooms').update({
    status: 'playing',
    currentquestion: 0,
    startedat: new Date().toISOString()
  }).eq('id', currentRoom.id);

  if (error) {
    const roomMessage = document.getElementById('roomMessage');
    if (roomMessage) roomMessage.textContent = 'Ошибка: ' + error.message;
  }
});

document.getElementById('leaveRoomBtn')?.addEventListener('click', async () => {
  await leaveRoomIfAny();
  showScreen('screenHome');
});

async function leaveRoomIfAny() {
  if (!currentRoom || !currentUser) return;

  unsubscribeRoom();

  await db.from('roomplayers')
    .update({ leftat: new Date().toISOString() })
    .eq('roomid', currentRoom.id)
    .eq('userid', currentUser.id);

  if (currentRoom.hostid === currentUser.id) {
    const remaining = roomPlayers.filter(p => p.userid !== currentUser.id);
    if (remaining.length > 0) {
      await db.from('rooms').update({ hostid: remaining[0].userid }).eq('id', currentRoom.id);
    } else {
      await db.from('rooms').update({ status: 'finished' }).eq('id', currentRoom.id);
    }
  }

  currentRoom = null;
  isHost = false;
  roomPlayers = [];
}

function startGame() {
  gameState = {
    questionIndex: 0,
    score: 0,
    answers: [],
    answered: false,
    timerInterval: null,
    timeLeft: QUESTION_TIME
  };

  showScreen('screenGame');
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[gameState.questionIndex];
  const total = QUESTIONS.length;

  document.getElementById('questionNum').textContent = gameState.questionIndex + 1;
  document.getElementById('questionTotal').textContent = total;
  document.getElementById('questionText').textContent = q.text;
  document.getElementById('liveScore').textContent = gameState.score;
  document.getElementById('answerFeedback').style.display = 'none';
  document.getElementById('waitingOthers').style.display = 'none';

  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  const letters = ['А', 'Б', 'В', 'Г'];

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span>${escHtml(opt)}`;
    btn.addEventListener('click', () => onAnswer(i));
    grid.appendChild(btn);
  });

  gameState.answered = false;
  gameState.timeLeft = QUESTION_TIME;
  startTimer();
}

function startTimer() {
  clearTimer();
  updateTimerUI(QUESTION_TIME, QUESTION_TIME);

  gameState.timerInterval = setInterval(() => {
    gameState.timeLeft--;
    updateTimerUI(gameState.timeLeft, QUESTION_TIME);

    if (gameState.timeLeft <= 0) {
      clearTimer();
      onTimeout();
    }
  }, 1000);
}

function clearTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}

function updateTimerUI(timeLeft, total) {
  document.getElementById('timerText').textContent = timeLeft;
  const circle = document.getElementById('timerCircle');
  const circumference = 150.8;
  const fraction = timeLeft / total;
  circle.style.strokeDashoffset = circumference * (1 - fraction);
  circle.classList.remove('warning', 'danger');
  if (timeLeft <= 10) circle.classList.add('danger');
  else if (timeLeft <= 20) circle.classList.add('warning');
}

async function onAnswer(selectedIndex) {
  if (gameState.answered) return;
  gameState.answered = true;
  clearTimer();

  const q = QUESTIONS[gameState.questionIndex];
  const correct = selectedIndex === q.correct;

  if (correct) gameState.score++;

  gameState.answers.push({
    questionIndex: gameState.questionIndex,
    selectedIndex,
    correct,
    timeLeft: gameState.timeLeft
  });

  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add('correct');
    if (i === selectedIndex && !correct) btn.classList.add('wrong');
  });

  const fb = document.getElementById('answerFeedback');
  fb.style.display = 'flex';
  fb.className = 'answer-feedback ' + (correct ? 'correct' : 'wrong');
  document.getElementById('feedbackIcon').textContent = correct ? '✓' : '✗';
  document.getElementById('feedbackText').textContent = correct ? 'Правильно! +1 балл' : 'Неверно.';
  document.getElementById('liveScore').textContent = gameState.score;
  document.getElementById('waitingOthers').style.display = 'block';

  if (isHost) {
    await db.from('roomplayers')
      .update({ score: gameState.score })
      .eq('roomid', currentRoom.id)
      .eq('userid', currentUser.id);
  } else {
    await db.from('roomplayers')
      .update({ score: gameState.score })
      .eq('roomid', currentRoom.id)
      .eq('userid', currentUser.id);
  }

  setTimeout(() => goNextStep(), 3000);
}

function onTimeout() {
  if (gameState.answered) return;
  gameState.answered = true;

  const q = QUESTIONS[gameState.questionIndex];

  gameState.answers.push({
    questionIndex: gameState.questionIndex,
    selectedIndex: -1,
    correct: false,
    timeLeft: 0
  });

  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add('correct');
  });

  const fb = document.getElementById('answerFeedback');
  fb.style.display = 'flex';
  fb.className = 'answer-feedback timeout';
  document.getElementById('feedbackIcon').textContent = '⏱';
  document.getElementById('feedbackText').textContent = 'Время вышло!';

  setTimeout(() => goNextStep(), 3000);
}

function goNextStep() {
  const q = QUESTIONS[gameState.questionIndex];
  showRoundResult(q);
}

async function showRoundResult(q) {
  document.getElementById('revealAnswer').textContent = q.options[q.correct];
  const sb = document.getElementById('roundScoreboard');
  sb.innerHTML = '';

  const { data: players } = await db.from('roomplayers')
    .select('*')
    .eq('roomid', currentRoom.id)
    .is('leftat', null)
    .order('score', { ascending: false });

  (players || []).forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'sb-row';
    row.innerHTML = `
      <div class="sb-rank">${idx + 1}</div>
      <div class="sb-name">${escHtml(p.name)} ${p.userid === currentUser.id ? '<em style="font-size:.78rem;color:var(--text3)">(вы)</em>' : ''}</div>
      <div class="sb-score">${p.score}</div>
    `;
    sb.appendChild(row);
  });

  showScreen('screenRoundResult');

  let cnt = SHOW_RESULT_SECS;
  document.getElementById('nextCountdown').textContent = cnt;

  const iv = setInterval(async () => {
    cnt--;
    document.getElementById('nextCountdown').textContent = cnt;

    if (cnt <= 0) {
      clearInterval(iv);
      gameState.questionIndex++;

      if (gameState.questionIndex >= QUESTIONS.length) {
        await endGame();
      } else {
        if (isHost) {
          await db.from('rooms').update({ currentquestion: gameState.questionIndex }).eq('id', currentRoom.id);
        }
        showScreen('screenGame');
        renderQuestion();
      }
    }
  }, 1000);
}

async function endGame() {
  const attempt = await saveAttempt();

  if (currentRoom && isHost) {
    await db.from('rooms').update({ status: 'finished' }).eq('id', currentRoom.id);
  }

  showFinalResult(attempt);
}

async function saveAttempt() {
  if (!currentUser || !currentRoom) return null;

  await db.from('roomplayers')
    .update({ score: gameState.score })
    .eq('roomid', currentRoom.id)
    .eq('userid', currentUser.id);

  const { data: players } = await db.from('roomplayers')
    .select('*')
    .eq('roomid', currentRoom.id)
    .is('leftat', null)
    .order('score', { ascending: false });

  const place = (players || []).findIndex(p => p.userid === currentUser.id) + 1;

  const attemptData = {
    userid: currentUser.id,
    username: currentProfile.name,
    useremail: currentProfile.email,
    roomid: currentRoom.id,
    roomcode: currentRoom.code,
    score: gameState.score,
    maxscore: QUESTIONS.length,
    place: place || 1,
    answers: gameState.answers,
    playedat: new Date().toISOString()
  };

  await db.from('quizattempts').insert(attemptData);

  return { ...attemptData, players };
}

function showFinalResult(attempt) {
  showScreen('screenFinalResult');

  const players = attempt?.players || [
    { userid: currentUser.id, name: currentProfile.name, groupname: currentProfile.groupname, score: gameState.score }
  ];

  const podium = document.getElementById('finalPodium');
  podium.innerHTML = '';

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const podiumOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  const placeNums = { 0: 2, 1: 1, 2: 3 };

  podiumOrder.forEach((p, idx) => {
    const place = placeNums[idx];
    const div = document.createElement('div');
    div.className = `podium-item place-${place}`;
    div.innerHTML = `
      <div class="podium-avatar">${avatarLetter(p.name)}</div>
      <div class="podium-name">${escHtml(p.name)}</div>
      <div class="podium-score">${p.score} очк.</div>
      <div class="podium-block">#${place}</div>
    `;
    podium.appendChild(div);
  });

  const tbody = document.getElementById('finalTableBody');
  tbody.innerHTML = '';

  sorted.forEach((p, i) => {
    const tr = document.createElement('tr');
    if (p.userid === currentUser.id) tr.classList.add('me');
    tr.innerHTML = `<td>${i + 1}</td><td>${escHtml(p.name)}</td><td>${escHtml(p.groupname || '—')}</td><td><strong>${p.score}</strong></td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById('backHomeFromFinal')?.addEventListener('click', async () => {
  await leaveRoomIfAny();
  showScreen('screenHome');
});

document.getElementById('goResultsBtn')?.addEventListener('click', () => loadMyResults());
document.getElementById('backHomeFromResults')?.addEventListener('click', () => showScreen('screenHome'));

async function loadMyResults() {
  showScreen('screenMyResults');
  const list = document.getElementById('myResultsList');
  list.innerHTML = '<div class="loading-spinner">Загрузка…</div>';

  const { data, error } = await db.from('quizattempts')
    .select('*')
    .eq('userid', currentUser.id)
    .order('playedat', { ascending: false });

  if (error || !data?.length) {
    list.innerHTML = '<div class="no-results">Вы ещё не сыграли ни одной игры</div>';
    return;
  }

  list.innerHTML = '';
  data.forEach(attempt => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const placeClass =
      attempt.place === 1 ? 'place-1-badge' :
      attempt.place === 2 ? 'place-2-badge' :
      attempt.place === 3 ? 'place-3-badge' : 'place-other';

    card.innerHTML = `
      <div class="result-card-header">
        <span class="result-room">Комната ${escHtml(attempt.roomcode)}</span>
        <span class="result-date">${formatDate(attempt.playedat)}</span>
      </div>
      <div class="result-meta">
        <span class="result-stat">Очки: <strong>${attempt.score}/${attempt.maxscore}</strong></span>
        <span class="result-stat">
          Место: <span class="result-place-badge ${placeClass}">#${attempt.place}</span>
        </span>
      </div>
    `;
    list.appendChild(card);
  });
}

function subscribeGameSync() {
  if (gameSyncSub) db.removeChannel(gameSyncSub);

  gameSyncSub = db.channel('game-sync-' + currentRoom.id)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${currentRoom.id}`
    }, payload => {
      const updated = payload.new;
      if (!updated) return;

      currentRoom = updated;

      if (!isHost && updated.currentquestion !== undefined && updated.currentquestion !== gameState.questionIndex) {
        gameState.questionIndex = updated.currentquestion;
      }

      if (updated.status === 'finished') {
        if (gameSyncSub) {
          db.removeChannel(gameSyncSub);
          gameSyncSub = null;
        }
        endGame();
      }
    })
    .subscribe();

  return gameSyncSub;
}
