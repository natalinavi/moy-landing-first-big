/**
 * app.js — основная логика Telegram Mini App «Диагностика бизнеса»
 *
 * Навигация между экранами:
 *   showScreen(id, direction) — показать экран (direction: 'forward' | 'back')
 *
 * Экраны: 'welcome' → 'question' (1–6) → 'loading' → 'result' → 'cta'
 *
 * Для изменения Telegram-ника Натальи найди константу EXPERT_TG_USERNAME.
 * Для изменения счётчика «847 предпринимателей» найди константу SOCIAL_PROOF_COUNT.
 */

/* ─── Инициализация Telegram Web App ─── */
const tg = window.Telegram?.WebApp;

// Telegram передаёт все данные пользователя в хэше URL:
//   #tgWebAppData=user%3D...%26auth_date%3D...%26hash%3D...&tgWebAppPlatform=ios&...
// Читаем их напрямую — это надёжнее, чем полагаться на SDK.
function parseHashUser() {
  try {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const rawData = hashParams.get('tgWebAppData');
    if (!rawData) return null;
    const dataParams = new URLSearchParams(rawData);
    const userRaw = dataParams.get('user');
    if (!userRaw) return null;
    return JSON.parse(userRaw);
  } catch (e) { return null; }
}

const _hashParams = new URLSearchParams(window.location.hash.slice(1));
const _hashUser   = parseHashUser();

// Три независимых признака работы внутри Telegram:
// 1. tgWebAppData в хэше — Telegram всегда добавляет его при открытии Mini App
// 2. TelegramWebviewProxy — нативный мост Telegram WebView
// 3. tg.platform из SDK (запасной)
const isInTelegram = Boolean(
  _hashParams.has('tgWebAppData') ||
  (typeof window.TelegramWebviewProxy !== 'undefined') ||
  (tg && tg.platform && tg.platform !== 'unknown' && tg.platform !== '')
);

if (tg) {
  try { tg.ready(); }  catch(e) { /* вне Telegram — игнорируем */ }
  try { tg.expand(); } catch(e) { /* вне Telegram — игнорируем */ }
}

/* ─── Настройки ─── */
// Замени на реальный Telegram-ник для кнопки «Записаться на звонок»
const EXPERT_TG_USERNAME = 'natalinavi';

// Базовое число для блока социального доказательства.
// К нему прибавляется количество завершений квиза на этом устройстве.
// Для глобального счётчика через всех пользователей — нужен бэкенд.
const SOCIAL_PROOF_BASE = 122;

/* ─── Состояние приложения ─── */
const state = {
  currentScreen: 'welcome',  // текущий экран
  questionIndex: 0,          // индекс текущего вопроса (0–5)
  answers: [],               // массив выбранных баллов
  score: 0,                  // итоговый балл
  isTransitioning: false,    // защита от двойного нажатия
};

/* ─── Ссылки на DOM-элементы ─── */
const screens = {
  welcome:  document.getElementById('screen-welcome'),
  question: document.getElementById('screen-question'),
  loading:  document.getElementById('screen-loading'),
  result:   document.getElementById('screen-result'),
  cta:      document.getElementById('screen-cta'),
};

const progressFill  = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const questionText  = document.getElementById('question-text');
const answersList   = document.getElementById('answers-list');
const loadingSteps  = document.querySelectorAll('.loading-step');

const resultGreeting   = document.getElementById('result-greeting');
const resultEmoji      = document.getElementById('result-emoji');
const resultScaleFill  = document.getElementById('result-scale-fill');
const resultScore      = document.getElementById('result-score');
const resultTitle      = document.getElementById('result-title');
const resultDesc       = document.getElementById('result-desc');
const resultStepsList  = document.getElementById('result-steps');

/* ─── Применение темы Telegram ─── */
function applyTheme() {
  const params = tg?.themeParams || {};
  const root = document.documentElement;

  // Устанавливаем CSS-переменные из themeParams Telegram
  // Фолбэк-значения — светлая тема
  root.style.setProperty('--bg',          params.bg_color           || '#ffffff');
  root.style.setProperty('--text',        params.text_color         || '#000000');
  root.style.setProperty('--hint',        params.hint_color         || '#8e8e93');
  root.style.setProperty('--accent',      params.button_color       || '#2AABEE');
  root.style.setProperty('--accent-text', params.button_text_color  || '#ffffff');
  root.style.setProperty('--card',        params.secondary_bg_color || '#f2f2f7');

  // Синхронизируем фон body с Telegram
  document.body.style.backgroundColor = params.bg_color || '#ffffff';
}

// Слушаем смену темы (пользователь переключил тёмную/светлую)
if (tg) { try { tg.onEvent('themeChanged', applyTheme); } catch(e) {} }
applyTheme();

/* ─── Нативные элементы Telegram ─── */
const mainBtn = tg?.MainButton;
const backBtn = tg?.BackButton;

// Haptic feedback — безопасный вызов (если не в Telegram — нет ошибки)
function haptic(type, value) {
  if (!tg?.HapticFeedback) return;
  if (type === 'impact')       tg.HapticFeedback.impactOccurred(value || 'light');
  if (type === 'notification') tg.HapticFeedback.notificationOccurred(value);
}

/* ─── Переходы между экранами ─── */
// direction: 'forward' (слайд слева) | 'back' (слайд справа)
function showScreen(id, direction = 'forward') {
  if (state.isTransitioning) return;
  if (state.currentScreen === id) return;

  state.isTransitioning = true;

  const current = screens[state.currentScreen];
  const next    = screens[id];

  // Текущий экран уходит
  current.classList.remove('active');
  current.classList.add(direction === 'forward' ? 'exit-left' : 'exit-right');

  // Следующий экран приходит
  if (direction === 'back') {
    next.classList.add('enter-left');
  }
  // Убираем enter-left сразу же (нужен для начального позиционирования)
  requestAnimationFrame(() => {
    next.classList.remove('enter-left');
    next.classList.add('active');
  });

  state.currentScreen = id;

  // После завершения анимации чистим классы
  setTimeout(() => {
    current.classList.remove('exit-left', 'exit-right');
    state.isTransitioning = false;
  }, 280);
}

/* ─── Счётчик прохождений ─── */
// Читаем сохранённое число завершений из localStorage и суммируем с базой
function getSocialProofCount() {
  const saved = parseInt(localStorage.getItem('quiz_completions') || '0', 10);
  return SOCIAL_PROOF_BASE + saved;
}

// Склонение слова «предприниматель» по числу (правила русского языка)
// 1, 21, 31... → «предприниматель»
// 2–4, 22–24... → «предпринимателя»
// 5–20, 11–19, 25–30... → «предпринимателей»
function pluralEntrepreneur(n) {
  const last2 = n % 100;
  const last1 = n % 10;
  if (last2 >= 11 && last2 <= 19) return 'предпринимателей';
  if (last1 === 1)                 return 'предприниматель';
  if (last1 >= 2 && last1 <= 4)   return 'предпринимателя';
  return 'предпринимателей';
}

// Вызывается при каждом завершении квиза (переходе на экран CTA)
function incrementCompletionCounter() {
  const current = parseInt(localStorage.getItem('quiz_completions') || '0', 10);
  localStorage.setItem('quiz_completions', String(current + 1));
}

/* ─── ЭКРАН 0: Приветствие ─── */
function initWelcome() {
  // Устанавливаем счётчик с правильным склонением
  const count = getSocialProofCount();
  const counter = document.getElementById('social-proof-count');
  const word    = document.getElementById('social-proof-word');
  if (counter) counter.textContent = count;
  if (word)    word.textContent    = pluralEntrepreneur(count);

  // Приветствие по имени из Telegram (SDK или URL-хэш)
  const firstName = tg?.initDataUnsafe?.user?.first_name || _hashUser?.first_name;
  const greeting  = document.getElementById('welcome-greeting');
  if (greeting && firstName) {
    greeting.textContent = `Привет, ${firstName} 👋`;
    greeting.style.display = 'block';
  }

  // Кнопка «Поделиться с другом»
  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      haptic('impact', 'light');
      const text = 'Проверь, держится ли твой бизнес на системе или на тебе — квиз за 2 минуты 👇';
      const url  = 'https://t.me/AI_questionquiz_bot/app';
      if (isInTelegram && tg) {
        // Нативный шаринг внутри Telegram
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
      } else {
        // В браузере — Web Share API или копируем ссылку
        if (navigator.share) {
          navigator.share({ title: 'Квиз для предпринимателей', text, url });
        } else {
          navigator.clipboard?.writeText(`${text}\n${url}`);
          shareBtn.textContent = '✓ Ссылка скопирована';
          setTimeout(() => { shareBtn.textContent = '🔗 Поделиться с другом'; }, 2000);
        }
      }
    });
  }

  // MainButton: «Начать диагностику»
  if (isInTelegram && mainBtn) {
    mainBtn.setText('Начать диагностику →');
    mainBtn.show();
    mainBtn.onClick(startQuiz);
  } else {
    // Фолбэк: в браузере показываем кнопку внутри экрана
    const fallback = document.getElementById('btn-start-fallback');
    if (fallback) {
      fallback.style.display = 'flex';
      fallback.addEventListener('click', startQuiz, { once: true });
    }
  }

  // BackButton: скрыта
  if (isInTelegram && backBtn) backBtn.hide();
}

function startQuiz() {
  state.questionIndex = 0;
  state.answers = [];
  showQuestion(0);
  showScreen('question', 'forward');
}

/* ─── ЭКРАНЫ 1–6: Вопросы ─── */
function showQuestion(index) {
  const q = QUESTIONS[index];
  if (!q) return;

  // Прогресс-бар
  const percent = ((index) / QUESTIONS.length) * 100;
  progressFill.style.width = percent + '%';
  progressLabel.textContent = `Шаг ${index + 1} из ${QUESTIONS.length}`;

  // Текст вопроса
  questionText.textContent = q.text;

  // Рендер ответов
  answersList.innerHTML = '';
  q.answers.forEach((answer, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = answer.text;
    btn.addEventListener('click', () => handleAnswer(i, answer.score));
    answersList.appendChild(btn);
  });

  // BackButton Telegram: показываем на всех вопросах (с 1-го → welcome)
  if (isInTelegram && backBtn) {
    backBtn.show();
  }

  // Фолбэк-кнопка «Назад» для браузера
  if (!isInTelegram) {
    const backFallback = document.getElementById('btn-back-question');
    if (backFallback) {
      if (index === 0) {
        backFallback.style.display = 'none';
      } else {
        backFallback.style.display = 'block';
        // Клонируем чтобы убрать старые обработчики
        const newBtn = backFallback.cloneNode(true);
        backFallback.parentNode.replaceChild(newBtn, backFallback);
        newBtn.addEventListener('click', goBackFromQuestion);
      }
    }
  }

  // MainButton: скрыта на вопросах
  if (isInTelegram && mainBtn) mainBtn.hide();
}

function handleAnswer(answerIndex, score) {
  // Защита от повторного нажатия
  if (state.isTransitioning) return;

  // Haptic: лёгкий удар при выборе ответа
  haptic('impact', 'light');

  // Подсвечиваем выбранный ответ
  const buttons = answersList.querySelectorAll('.answer-btn');
  buttons.forEach(b => b.disabled = true);
  buttons[answerIndex].classList.add('selected');

  // Сохраняем балл и индекс ответа (для восстановления текста)
  state.answers.push({ score, answerIndex });

  // Автопереход через 550 мс
  setTimeout(() => {
    const nextIndex = state.questionIndex + 1;

    if (nextIndex < QUESTIONS.length) {
      // Следующий вопрос
      state.questionIndex = nextIndex;
      showQuestion(nextIndex);

      // Плавный переход: контент вопроса обновляется внутри того же экрана
      // Делаем mini-fade для контента (без смены экрана)
      const content = document.querySelector('#screen-question .screen-content');
      content.style.opacity = '0';
      content.style.transform = 'translateX(20px)';
      requestAnimationFrame(() => {
        content.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        content.style.opacity = '1';
        content.style.transform = 'translateX(0)';
        setTimeout(() => {
          content.style.transition = '';
        }, 200);
      });
    } else {
      // Все вопросы отвечены — переходим к загрузке
      state.score = state.answers.reduce((sum, a) => sum + a.score, 0);
      showScreen('loading', 'forward');
      runLoadingScreen();
    }
  }, 550);
}

// Навигация назад по вопросам
function goBackFromQuestion() {
  if (state.questionIndex === 0) {
    // С первого вопроса → приветствие
    if (isInTelegram && mainBtn) {
      mainBtn.setText('Начать диагностику →');
      mainBtn.show();
    }
    showScreen('welcome', 'back');
    return;
  }

  // Убираем последний ответ
  state.answers.pop();
  state.questionIndex -= 1;
  showQuestion(state.questionIndex);

  // mini-fade контента
  const content = document.querySelector('#screen-question .screen-content');
  content.style.opacity = '0';
  content.style.transform = 'translateX(-20px)';
  requestAnimationFrame(() => {
    content.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    content.style.opacity = '1';
    content.style.transform = 'translateX(0)';
    setTimeout(() => { content.style.transition = ''; }, 200);
  });
}

/* ─── ЭКРАН 7: Загрузка ─── */
function runLoadingScreen() {
  // MainButton показывает спиннер Telegram
  if (isInTelegram && mainBtn) {
    mainBtn.show();
    mainBtn.showProgress();
  }
  if (isInTelegram && backBtn) backBtn.hide();

  // Сбрасываем шаги загрузки
  loadingSteps.forEach(s => s.classList.remove('visible'));

  // Показываем шаги последовательно
  setTimeout(() => loadingSteps[0]?.classList.add('visible'), 100);
  setTimeout(() => loadingSteps[1]?.classList.add('visible'), 900);
  setTimeout(() => loadingSteps[2]?.classList.add('visible'), 1700);

  // Автопереход на результат через 2.5 сек
  setTimeout(() => {
    if (isInTelegram && mainBtn) mainBtn.hideProgress();
    showScreen('result', 'forward');
    renderResult();
  }, 2500);

  // Параллельно: отправляем данные на бэкенд (опционально)
  sendResultToBackend();
}

/* ─── ЭКРАН 8: Результат ─── */
function renderResult() {
  const level  = getResultLevel(state.score);
  const result = RESULTS[level];

  // Имя пользователя из Telegram SDK или URL-хэша
  const user      = tg?.initDataUnsafe?.user || _hashUser;
  const firstName = user?.first_name || '';

  // Персональный заголовок
  resultGreeting.textContent = firstName
    ? `Ваш результат, ${firstName}:`
    : 'Ваш результат:';

  // Эмодзи и шкала
  resultEmoji.textContent = result.emoji;

  // Анимируем шкалу с небольшой задержкой (нужно, чтобы экран уже появился)
  setTimeout(() => {
    const percent = (state.score / 18) * 100;
    resultScaleFill.style.width = percent + '%';
    resultScaleFill.style.background = result.color;
  }, 150);

  resultScore.textContent = `${state.score} из 18`;

  // Название уровня
  resultTitle.textContent  = result.title;
  resultTitle.style.color  = result.color;

  // Описание
  resultDesc.textContent = result.description;

  // Шаги
  resultStepsList.innerHTML = '';
  result.steps.forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    resultStepsList.appendChild(li);
  });

  // Haptic по уровню результата
  haptic('notification', result.haptic);

  // BackButton: скрыта на результате
  if (isInTelegram && backBtn) backBtn.hide();

  // MainButton: «Разобрать мою ситуацию»
  if (isInTelegram && mainBtn) {
    mainBtn.hide();
    mainBtn.setText('Разобрать мою ситуацию →');
    setTimeout(() => mainBtn.show(), 400);
    mainBtn.offClick(goToCta);
    mainBtn.onClick(goToCta);
  } else {
    const fallback = document.getElementById('btn-result-fallback');
    if (fallback) {
      fallback.style.display = 'flex';
      fallback.addEventListener('click', goToCta, { once: true });
    }
  }
}

function goToCta() {
  // Квиз пройден до конца — считаем завершение
  incrementCompletionCounter();
  showScreen('cta', 'forward');
  initCta();
}

/* ─── Форматирование и сохранение результатов ─── */
function buildResultsText() {
  const level  = getResultLevel(state.score);
  const result = RESULTS[level];
  const user   = tg?.initDataUnsafe?.user || _hashUser;
  const name   = user?.first_name ? `, ${user.first_name}` : '';

  let text = `📊 Результаты квиза${name}\n`;
  text += `Итог: ${result.emoji} ${result.title} (${state.score} из 18)\n\n`;

  state.answers.forEach((a, i) => {
    const q = QUESTIONS[i];
    const answerText = q.answers[a.answerIndex].text;
    text += `${i + 1}. ${q.text}\n`;
    text += `   → ${answerText}\n\n`;
  });

  return text.trim();
}

function saveResults() {
  const btn = document.getElementById('btn-save-results');

  // userId из SDK, или из URL-хэша как запасной вариант
  const userId = tg?.initDataUnsafe?.user?.id || _hashUser?.id;

  if (isInTelegram && userId) {
    const body = {
      initData:    tg.initData || '',
      userId:      userId,
      resultsText: buildResultsText(),
      score:       state.score,
      level:       getResultLevel(state.score),
    };

    btn.textContent = '⏳ Отправляем...';
    btn.disabled = true;

    fetch('/api/save-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          btn.textContent = '✓ Результаты сохранены';
        } else {
          btn.textContent = '💾 Сохранить результаты';
          btn.disabled = false;
        }
      })
      .catch(() => {
        btn.textContent = '💾 Сохранить результаты';
        btn.disabled = false;
      });
  } else {
    // В браузере — копируем в буфер
    navigator.clipboard?.writeText(buildResultsText()).then(() => {
      btn.textContent = '✓ Скопировано в буфер';
      setTimeout(() => { btn.textContent = '💾 Сохранить результаты'; }, 2500);
    });
  }
}

/* ─── ЭКРАН 9: CTA / Запись ─── */
function initCta() {
  // Кнопка «Сохранить результаты»
  const saveBtn = document.getElementById('btn-save-results');
  if (saveBtn) {
    saveBtn.replaceWith(saveBtn.cloneNode(true)); // сбрасываем старые обработчики
    document.getElementById('btn-save-results').addEventListener('click', saveResults);
  }

  // BackButton → назад на результат
  if (isInTelegram && backBtn) {
    backBtn.show();
    backBtn.offClick(goBackFromCta);
    backBtn.onClick(goBackFromCta);
  }

  // MainButton: «Записаться на звонок»
  if (isInTelegram && mainBtn) {
    mainBtn.offClick(goToCta);
    mainBtn.setText('Забронировать встречу →');
    mainBtn.show();
    mainBtn.offClick(openExpertChat);
    mainBtn.onClick(openExpertChat);
  } else {
    const fallback = document.getElementById('btn-cta-fallback');
    if (fallback) {
      fallback.style.display = 'flex';
      fallback.addEventListener('click', openExpertChat, { once: true });
    }
  }
}

function openExpertChat() {
  haptic('impact', 'medium');
  const url = `https://t.me/${EXPERT_TG_USERNAME}`;
  if (isInTelegram && tg) {
    // openTelegramLink открывает чат прямо внутри Telegram, без браузера
    tg.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}

function goBackFromCta() {
  showScreen('result', 'back');

  // Восстанавливаем MainButton результата
  if (isInTelegram && mainBtn) {
    mainBtn.offClick(openExpertChat);
    mainBtn.setText('Разобрать мою ситуацию →');
    mainBtn.show();
    mainBtn.offClick(goToCta);
    mainBtn.onClick(goToCta);
  }
  if (isInTelegram && backBtn) backBtn.hide();
}

/* ─── Отправка результата на бэкенд ─── */
function sendResultToBackend() {
  const level = getResultLevel(state.score);
  const payload = {
    initData:    tg?.initData || '',
    answers:     state.answers,
    totalScore:  state.score,
    level:       level,
    resultTitle: RESULTS[level]?.title || '',
    startParam:  tg?.initDataUnsafe?.start_param || '',
  };

  fetch('https://navi-prolab.ru/api/result', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(err => console.warn('Backend unavailable:', err));
}

/* ─── Сохранение прогресса (CloudStorage) ─── */
function saveProgress() {
  if (!tg?.CloudStorage) return;
  tg.CloudStorage.setItem('quiz_progress', JSON.stringify({
    questionIndex: state.questionIndex,
    answers: state.answers,
  }));
}

// Восстанавливаем прогресс, если пользователь закрыл и переоткрыл
function restoreProgress() {
  if (!tg?.CloudStorage) return;
  tg.CloudStorage.getItem('quiz_progress', (err, val) => {
    if (err || !val) return;
    try {
      const saved = JSON.parse(val);
      if (saved.answers?.length > 0 && saved.answers.length < QUESTIONS.length) {
        // Есть незавершённый квиз — предлагаем продолжить
        // В MVP просто игнорируем и начинаем заново
      }
    } catch (e) { /* игнорируем */ }
  });
}

/* ─── Настройка BackButton (глобальный обработчик) ─── */
if (isInTelegram && backBtn) {
  backBtn.onClick(() => {
    if (state.currentScreen === 'question') goBackFromQuestion();
    if (state.currentScreen === 'cta')      goBackFromCta();
  });
}


/* ─── Модалка-оффер ─── */
// Показывается ТОЛЬКО в браузере (не внутри Telegram) и только один раз
function initOfferModal() {
  if (isInTelegram) return;                          // внутри Telegram — не показываем
  if (localStorage.getItem('offer_shown')) return;   // уже видели — не показываем

  const overlay = document.getElementById('offer-overlay');
  if (!overlay) return;

  setTimeout(() => overlay.classList.add('visible'), 80);

  function closeModal() {
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 320);
    localStorage.setItem('offer_shown', '1');
  }

  document.getElementById('offer-btn-subscribe')?.addEventListener('click', closeModal);
  document.getElementById('offer-btn-skip')?.addEventListener('click', closeModal);
}

/* ─── Инициализация приложения ─── */
function init() {
  restoreProgress();
  initWelcome();

  // Показываем начальный экран
  screens.welcome.classList.add('active');

  // Модалка-оффер (только в браузере, только первый раз)
  initOfferModal();
}

init();
