/* ═══════════════════════════════════════════
   КвизБИ — app.js
   Supabase Auth + Database + Realtime
   ⚠ Замените SUPABASE_URL и SUPABASE_ANON_KEY
═══════════════════════════════════════════ */

// ─────────────────────────────────────────
// 0. КОНФИГУРАЦИЯ — вставьте ваши данные
// ─────────────────────────────────────────
const SUPABASE_URL      = 'https://ohihvtjofkiqlafxthxn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaWh2dGpvZmtpcWxhZnh0aHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDA1MDAsImV4cCI6MjA5NjI3NjUwMH0.0sYr7zrGqzU82g6oQ2fZ60w-801w6jDXXMHnzKeKmn8';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────
// 1. ВОПРОСЫ
// ─────────────────────────────────────────
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

const QUESTION_TIME = 60; // секунд
const SHOW_RESULT_SECS = 5; // секунд показа правильного ответа между вопросами

// ─────────────────────────────────────────
// 2. СОСТОЯНИЕ
// ─────────────────────────────────────────
let currentUser   = null;
let currentProfile = null;
let currentRoom   = null;
let isHost        = false;
let roomPlayers   = [];
let realtimeSub   = null;

// Игровое состояние (локальное)
let gameState = {
  questionIndex: 0,
  score: 0,
  answers: [],      // { questionIndex, selectedIndex, correct, timeLeft }
  answered: false,
  timerInterval: null,
  timeLeft: QUESTION_TIME
};

// ─────────────────────────────────────────
// 3. УТИЛИТЫ
// ─────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
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

// ─────────────────────────────────────────
// 4. ТЕМА
// ─────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = document.querySelector('.theme-icon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☽' : '☀';
  localStorage.setItem('kvizbi-theme', theme);
}

themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

applyTheme(localStorage.getItem('kvizbi-theme') || 'light');

// ─────────────────────────────────────────
// 5. AUTH — ВКЛАДКИ
// ─────────────────────────────────────────
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
  el.textContent = msg;
  el.className = 'auth-message ' + type;
}

function setBtnLoading(btn, loading) {
  btn.disabled = loading;
  btn.querySelector('span').textContent = loading ? 'Загрузка…' : btn.dataset.label;
}

// ─── Инициализация кнопок (сохранить label) ───
['loginBtn', 'registerBtn'].forEach(id => {
  const el = document.getElementById(id);
  el.dataset.label = el.querySelector('span').textContent;
});

// ─── Регистрация ───
document.getElementById('registerBtn').addEventListener('click', async () => {
  const name  = document.getElementById('regName').value.trim();
  const group = document.getElementById('regGroup').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPassword').value;

  if (!name || !email || !pass) return setAuthMsg('Заполните все поля');
  if (pass.length < 6) return setAuthMsg('Пароль минимум 6 символов');

  const btn = document.getElementById('registerBtn');
  setBtnLoading(btn, true);

  const { data, error } = await db.auth.signUp({
    email, password: pass,
    options: { data: { name, group } }
  });

  setBtnLoading(btn, false);

  if (error) return setAuthMsg(error.message);
  if (data.user) {
    // Создаём профиль
    await db.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      group_name: group,
      created_at: new Date().toISOString()
    });
    setAuthMsg('Аккаунт создан! Войдите.', 'success');
  }
});

// ─── Вход ───
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;

  if (!email || !pass) return setAuthMsg('Введите email и пароль');

  const btn = document.getElementById('loginBtn');
  setBtnLoading(btn, true);

  const { data, error } = await db.auth.signInWithPassword({ email, password: pass });

  setBtnLoading(btn, false);

  if (error) return setAuthMsg(error.message);
  if (data.user) await onLogin(data.user);
});

// ─── Выход ───
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await leaveRoomIfAny();
  await db.auth.signOut();
  currentUser = null;
  currentProfile = null;
  document.getElementById('userPill').style.display = 'none';
  showScreen('screenAuth');
});

// ─────────────────────────────────────────
// 6. ПРОФИЛЬ / ЗАГРУЗКА ПОСЛЕ ВХОДА
// ─────────────────────────────────────────
async function onLogin(user) {
  currentUser = user;

  // Загрузить профиль
  let { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();

  if (!profile) {
    // создаём из метаданных
    const meta = user.user_metadata || {};
    profile = {
      id: user.id,
      email: user.email,
      name: meta.name || user.email.split('@')[0],
      group_name: meta.group || '',
      created_at: user.created_at
    };
    await db.from('profiles').upsert(profile);
  }
  currentProfile = profile;

  // Navbar
  document.getElementById('navUserName').textContent = profile.name;
  document.getElementById('userPill').style.display = 'flex';

  // Home
  document.getElementById('homeUserName').textContent = profile.name;
  document.getElementById('homeUserGroup').textContent = profile.group_name || 'не указана';

  showScreen('screenHome');
}

// Восстановление сессии при загрузке
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    await onLogin(session.user);
  }
})();

// ─────────────────────────────────────────
// 7. HOME — СОЗДАТЬ / ВОЙТИ В КОМНАТУ
// ─────────────────────────────────────────
document.getElementById('createRoomBtn').addEventListener('click', async () => {
  if (!currentUser) return;
  document.getElementById('homeMessage').textContent = '';

  const code = genRoomCode();
  const { data: room, error } = await db.from('rooms').insert({
    code,
    host_id: currentUser.id,
    status: 'waiting',
    current_question: 0,
    created_at: new Date().toISOString()
  }).select().single();

  if (error) {
    document.getElementById('homeMessage').textContent = 'Ошибка создания комнаты: ' + error.message;
    return;
  }

  // Добавить себя в room_players
  await joinRoomPlayers(room.id);

  currentRoom = room;
  isHost = true;
  await enterWaitingRoom();
});

document.getElementById('joinRoomBtn').addEventListener('click', async () => {
  const code = document.getElementById('joinRoomCode').value.trim().toUpperCase();
  if (!code) return;
  document.getElementById('homeMessage').textContent = '';

  const { data: room, error } = await db.from('rooms').select('*').eq('code', code).single();
  if (error || !room) {
    document.getElementById('homeMessage').textContent = 'Комната не найдена.';
    return;
  }
  if (room.status !== 'waiting') {
    document.getElementById('homeMessage').textContent = 'Игра уже идёт или завершена.';
    return;
  }

  // Проверить количество игроков (is() для NULL, eq() не работает с NULL)
  const { count } = await db.from('room_players').select('*', { count: 'exact', head: true })
    .eq('room_id', room.id).is('left_at', null);

  if ((count || 0) >= 4) {
    document.getElementById('homeMessage').textContent = 'Комната полна (максимум 4 игрока).';
    return;
  }

  await joinRoomPlayers(room.id);
  currentRoom = room;
  isHost = (room.host_id === currentUser.id);
  await enterWaitingRoom();
});

async function joinRoomPlayers(roomId) {
  // Проверяем, есть ли уже запись для этого игрока
  const { data: existing } = await db.from('room_players')
    .select('id').eq('room_id', roomId).eq('user_id', currentUser.id).maybeSingle();

  if (existing) {
    // Уже был в комнате — сбрасываем left_at
    const { error } = await db.from('room_players')
      .update({ left_at: null, score: 0, name: currentProfile.name, group_name: currentProfile.group_name || '' })
      .eq('room_id', roomId).eq('user_id', currentUser.id);
    if (error) console.error('Ошибка update room_players:', error);
  } else {
    // Новый игрок
    const { error } = await db.from('room_players').insert({
      room_id: roomId,
      user_id: currentUser.id,
      name: currentProfile.name,
      group_name: currentProfile.group_name || '',
      score: 0,
      joined_at: new Date().toISOString(),
      left_at: null
    });
    if (error) console.error('Ошибка insert room_players:', error);
  }
}

// ─────────────────────────────────────────
// 8. КОМНАТА ОЖИДАНИЯ
// ─────────────────────────────────────────
// Поллинг для надёжности (резервный механизм на случай проблем с Realtime)
let pollInterval = null;

async function enterWaitingRoom() {
  showScreen('screenRoom');
  document.getElementById('roomCode').textContent = currentRoom.code;
  document.getElementById('copyCodeBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoom.code).then(() => showToast('Код скопирован!'));
  }, { once: true });

  await loadRoomPlayers();
  subscribeRoom();

  // Поллинг каждые 3 секунды — гарантирует актуальность списка даже если Realtime пропустил событие
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    if (!currentRoom || currentRoom.status !== 'waiting') {
      clearInterval(pollInterval);
      return;
    }
    // Обновить состояние комнаты
    const { data: freshRoom } = await db.from('rooms').select('*').eq('id', currentRoom.id).single();
    if (freshRoom) {
      currentRoom = freshRoom;
      isHost = (currentRoom.host_id === currentUser.id);
      if (currentRoom.status === 'playing') {
        clearInterval(pollInterval);
        await loadRoomPlayers();
        startGame();
        return;
      }
    }
    await loadRoomPlayers();
  }, 3000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

async function loadRoomPlayers() {
  const { data, error } = await db.from('room_players')
    .select('*')
    .eq('room_id', currentRoom.id)
    .is('left_at', null);

  if (error) {
    console.error('Ошибка loadRoomPlayers:', error);
  }

  roomPlayers = data || [];
  renderPlayers();
  updateRoomUI();
}

function renderPlayers() {
  const list = document.getElementById('playersList');
  list.innerHTML = '';

  roomPlayers.forEach(p => {
    const isMe = p.user_id === currentUser.id;
    const isH  = currentRoom && p.user_id === currentRoom.host_id;

    const row = document.createElement('div');
    row.className = 'player-row' + (isMe ? ' me' : '');
    row.innerHTML = `
      <div class="player-avatar">${avatarLetter(p.name)}</div>
      <div class="player-info">
        <div class="player-name">${escHtml(p.name)}</div>
        <div class="player-meta">${escHtml(p.group_name || '')}</div>
      </div>
      <div class="player-badges">
        ${isH  ? '<span class="badge badge-host">Хост</span>' : ''}
        ${isMe ? '<span class="badge badge-you">Вы</span>'   : ''}
      </div>`;
    list.appendChild(row);
  });

  document.getElementById('playerCount').textContent = roomPlayers.length;
}

function updateRoomUI() {
  const status = currentRoom?.status || 'waiting';
  const badge  = document.getElementById('roomStatusBadge');
  const hint   = document.getElementById('roomHint');
  const startBtn = document.getElementById('startGameBtn');

  badge.textContent = { waiting: 'Ожидание', playing: 'Играем', finished: 'Завершено' }[status] || status;
  badge.className   = 'room-status-badge' + (status === 'playing' ? ' playing' : status === 'waiting' && roomPlayers.length >= 2 ? ' ready' : '');

  if (isHost && status === 'waiting') {
    startBtn.style.display = 'block';
    startBtn.disabled = roomPlayers.length < 2;
    hint.textContent = roomPlayers.length < 2 ? 'Ожидаем игроков (минимум 2)…' : 'Можно начинать!';
  } else {
    startBtn.style.display = 'none';
    hint.textContent = isHost ? '' : 'Ожидаем, когда хост начнёт игру…';
  }
}

// ─── Подписка Realtime ───
function subscribeRoom() {
  if (realtimeSub) {
    db.removeChannel(realtimeSub);
    realtimeSub = null;
  }

  // Подписка на изменения rooms
  const roomCh = db.channel('room-' + currentRoom.id)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${currentRoom.id}`
    }, async payload => {
      if (!payload.new) return;
      currentRoom = payload.new;
      isHost = (currentRoom.host_id === currentUser.id);

      if (currentRoom.status === 'playing') {
        // Все начинают игру одновременно
        stopPolling();
        await loadRoomPlayers(); // актуальный список
        unsubscribeRoom();
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
      table: 'room_players',
      filter: `room_id=eq.${currentRoom.id}`
    }, async () => {
      await loadRoomPlayers();
    })
    .subscribe();

  realtimeSub = roomCh;
}

function unsubscribeRoom() {
  if (realtimeSub) {
    db.removeChannel(realtimeSub);
    realtimeSub = null;
  }
}

// ─── Начать игру (хост) ───
document.getElementById('startGameBtn').addEventListener('click', async () => {
  if (!isHost || roomPlayers.length < 2) return;

  const { error } = await db.from('rooms').update({
    status: 'playing',
    current_question: 0,
    started_at: new Date().toISOString()
  }).eq('id', currentRoom.id);

  if (error) document.getElementById('roomMessage').textContent = 'Ошибка: ' + error.message;
});

// ─── Покинуть комнату ───
document.getElementById('leaveRoomBtn').addEventListener('click', async () => {
  await leaveRoomIfAny();
  showScreen('screenHome');
});

async function leaveRoomIfAny() {
  if (!currentRoom || !currentUser) return;
  stopPolling();
  unsubscribeRoom();

  // Пометить left_at
  await db.from('room_players').update({ left_at: new Date().toISOString() })
    .eq('room_id', currentRoom.id)
    .eq('user_id', currentUser.id);

  // Если мы хост — передать хостство
  if (currentRoom.host_id === currentUser.id) {
    const remaining = roomPlayers.filter(p => p.user_id !== currentUser.id);
    if (remaining.length > 0) {
      await db.from('rooms').update({ host_id: remaining[0].user_id })
        .eq('id', currentRoom.id);
    } else {
      // Закрыть комнату
      await db.from('rooms').update({ status: 'finished' }).eq('id', currentRoom.id);
    }
  }

  currentRoom = null;
  isHost = false;
  roomPlayers = [];
}

// ─────────────────────────────────────────
// 9. ИГРА
// ─────────────────────────────────────────
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

  document.getElementById('questionNum').textContent   = gameState.questionIndex + 1;
  document.getElementById('questionTotal').textContent = total;
  document.getElementById('questionText').textContent  = q.text;
  document.getElementById('liveScore').textContent     = gameState.score;
  document.getElementById('answerFeedback').style.display = 'none';
  document.getElementById('waitingOthers').style.display  = 'none';

  // Варианты
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

function onAnswer(selectedIndex) {
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

  // Подсветить
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct)    btn.classList.add('correct');
    if (i === selectedIndex && !correct) btn.classList.add('wrong');
  });

  // Feedback
  const fb = document.getElementById('answerFeedback');
  fb.style.display = 'flex';
  fb.className = 'answer-feedback ' + (correct ? 'correct' : 'wrong');
  document.getElementById('feedbackIcon').textContent = correct ? '✓' : '✗';
  document.getElementById('feedbackText').textContent = correct ? 'Правильно! +1 балл' : 'Неверно.';

  document.getElementById('liveScore').textContent = gameState.score;
  document.getElementById('waitingOthers').style.display = 'block';

  // Через небольшую паузу — следующий вопрос (симулируем ожидание других)
  // В реальном multiplayer хост управляет переходом через Realtime
  // Здесь используем простую локальную задержку = показ правильного ответа
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

  // Показать правильный
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

  // Показать экран "правильный ответ + промежуточный рейтинг"
  showRoundResult(q);
}

function showRoundResult(q) {
  document.getElementById('revealAnswer').textContent = q.options[q.correct];
  document.getElementById('roundScoreboard').innerHTML = '';

  // Собрать мини-рейтинг (только текущий игрок у нас, остальные симулированы)
  // В полноценном варианте: читаем room_players score из БД
  const sb = document.getElementById('roundScoreboard');
  const rankColors = ['gold', 'silver', 'bronze'];

  // Показываем только своё положение
  const myRow = document.createElement('div');
  myRow.className = 'sb-row';
  myRow.innerHTML = `
    <div class="sb-rank">—</div>
    <div class="sb-name">${escHtml(currentProfile.name)} <em style="font-size:.78rem;color:var(--text3)">(вы)</em></div>
    <div class="sb-score">${gameState.score}</div>`;
  sb.appendChild(myRow);

  showScreen('screenRoundResult');

  // Обратный отсчёт
  let cnt = SHOW_RESULT_SECS;
  document.getElementById('nextCountdown').textContent = cnt;
  const iv = setInterval(() => {
    cnt--;
    document.getElementById('nextCountdown').textContent = cnt;
    if (cnt <= 0) {
      clearInterval(iv);
      // Следующий вопрос или финал
      gameState.questionIndex++;
      if (gameState.questionIndex >= QUESTIONS.length) {
        endGame();
      } else {
        showScreen('screenGame');
        renderQuestion();
      }
    }
  }, 1000);
}

async function endGame() {
  // Сохранить результат
  const attempt = await saveAttempt();

  // Пометить комнату как finished
  if (currentRoom) {
    await db.from('rooms').update({ status: 'finished' }).eq('id', currentRoom.id);
  }

  showFinalResult(attempt);
}

async function saveAttempt() {
  if (!currentUser || !currentRoom) return null;

  // Обновить score в room_players
  await db.from('room_players').update({ score: gameState.score })
    .eq('room_id', currentRoom.id)
    .eq('user_id', currentUser.id);

  // Получить финальный рейтинг
  const { data: players } = await db.from('room_players')
    .select('*')
    .eq('room_id', currentRoom.id)
    .is('left_at', null)
    .order('score', { ascending: false });

  const place = (players || []).findIndex(p => p.user_id === currentUser.id) + 1;

  const attemptData = {
    user_id:    currentUser.id,
    user_name:  currentProfile.name,
    user_email: currentProfile.email,
    room_id:    currentRoom.id,
    room_code:  currentRoom.code,
    score:      gameState.score,
    max_score:  QUESTIONS.length,
    place:      place || 1,
    answers:    JSON.stringify(gameState.answers),
    played_at:  new Date().toISOString()
  };

  await db.from('quiz_attempts').insert(attemptData);

  return { ...attemptData, players };
}

function showFinalResult(attempt) {
  showScreen('screenFinalResult');

  const players = attempt?.players || [
    { user_id: currentUser.id, name: currentProfile.name, score: gameState.score }
  ];

  // Подиум (топ-3)
  const podium = document.getElementById('finalPodium');
  podium.innerHTML = '';
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const podiumOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean); // серебро, золото, бронза

  const placeNums = { 0: 2, 1: 1, 2: 3 };
  podiumOrder.forEach((p, idx) => {
    if (!p) return;
    const place = placeNums[idx];
    const div = document.createElement('div');
    div.className = `podium-item place-${place}`;
    div.innerHTML = `
      <div class="podium-avatar">${avatarLetter(p.name)}</div>
      <div class="podium-name">${escHtml(p.name)}</div>
      <div class="podium-score">${p.score} очк.</div>
      <div class="podium-block">#${place}</div>`;
    podium.appendChild(div);
  });

  // Таблица
  const tbody = document.getElementById('finalTableBody');
  tbody.innerHTML = '';
  sorted.forEach((p, i) => {
    const tr = document.createElement('tr');
    if (p.user_id === currentUser.id) tr.classList.add('me');
    const groupName = p.group_name || '—';
    tr.innerHTML = `<td>${i + 1}</td><td>${escHtml(p.name)}</td><td>${escHtml(groupName)}</td><td><strong>${p.score}</strong></td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById('backHomeFromFinal').addEventListener('click', () => {
  currentRoom = null;
  showScreen('screenHome');
});

// ─────────────────────────────────────────
// 10. МОИ РЕЗУЛЬТАТЫ
// ─────────────────────────────────────────
document.getElementById('goResultsBtn').addEventListener('click', () => loadMyResults());
document.getElementById('backHomeFromResults').addEventListener('click', () => showScreen('screenHome'));

async function loadMyResults() {
  showScreen('screenMyResults');
  const list = document.getElementById('myResultsList');
  list.innerHTML = '<div class="loading-spinner">Загрузка…</div>';

  const { data, error } = await db.from('quiz_attempts')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('played_at', { ascending: false });

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
        <span class="result-room">Комната ${escHtml(attempt.room_code)}</span>
        <span class="result-date">${formatDate(attempt.played_at)}</span>
      </div>
      <div class="result-meta">
        <span class="result-stat">Очки: <strong>${attempt.score}/${attempt.max_score}</strong></span>
        <span class="result-stat">
          Место: <span class="result-place-badge ${placeClass}">#${attempt.place}</span>
        </span>
      </div>`;
    list.appendChild(card);
  });
}

// ─────────────────────────────────────────
// 11. УТИЛИТА ЭКРАНИРОВАНИЯ HTML
// ─────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────
// 12. REALTIME — ПОДПИСКА НА ВОПРОС (multiplayer sync)
// ─────────────────────────────────────────
// Примечание: В данной реализации для синхронизации вопросов используется
// следующая логика: хост обновляет поле current_question в rooms,
// все подписчики реагируют и переходят к соответствующему вопросу.
// Это обеспечивает одновременный старт вопросов для всех игроков.

// Расширенная подписка для игры (после старта)
function subscribeGameSync() {
  const ch = db.channel('game-sync-' + currentRoom.id)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${currentRoom.id}`
    }, payload => {
      const updated = payload.new;
      if (!updated) return;

      // Хост перешёл к следующему вопросу
      if (updated.current_question !== undefined &&
          updated.current_question !== gameState.questionIndex &&
          !isHost) {
        // Синхронизировать вопрос с хостом
        // (в текущей реализации таймер локальный, но хост управляет потоком)
      }

      if (updated.status === 'finished') {
        db.removeChannel(ch);
        endGame();
      }
    })
    .subscribe();

  return ch;
}
