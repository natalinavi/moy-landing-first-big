# CLAUDE.md — Telegram Mini App «Диагностика бизнеса»

Квиз для диагностики зависимости бизнеса от владельца.
6 вопросов → персональный результат → CTA на консультацию.

---

## ОБЯЗАТЕЛЬНО при старте каждой сессии

1. Прочитай этот файл целиком
2. Прочитай `/Users/macpro/.claude/projects/-Users-macpro-Desktop-Proje-ts-my-landing/memory/MEMORY.md`
3. Прочитай файлы памяти за последние 3 дня в той же папке `memory/`
4. Выполни `git log --oneline -10` — узнай что было сделано последним
5. Прочитай `tg-app/app.js` и `tg-app/questions.js` — понять текущее состояние логики
6. Сообщи кратко: «Я в курсе. Последнее — [последний коммит]. Готов.»

**Цель:** начинать работу не с нуля, а с полным пониманием где мы находимся.

---

## Структура файлов

```
tg-app/
├── index.html      — единственный HTML-файл, всё приложение в нём
├── styles.css      — все стили: переменные темы, экраны, компоненты
├── app.js          — логика: навигация, Telegram SDK, рендер результата
├── questions.js    — данные: вопросы, ответы с баллами, тексты результатов
└── assets/
    ├── icon.svg    — иконка на приветственном экране (весы)
    └── photo.jpg   — фото Натальи на экране CTA
```

---

## Навигация между экранами

```
welcome  →  question (1→2→...→6)  →  loading  →  result  →  cta
                 ↑                                    ↑
           [BackButton]                         [BackButton ↑]
```

- **welcome → question**: нажатие MainButton «Начать диагностику»
- **question → question**: автопереход через 550 мс после выбора ответа
- **question 6 → loading**: после последнего ответа
- **loading → result**: автоматически через 2.5 секунды
- **result → cta**: нажатие MainButton «Разобрать мою ситуацию»
- **cta → result**: BackButton Telegram
- **question → предыдущий**: BackButton Telegram (вопрос 1 → welcome)

---

## Где менять данные

### Вопросы и ответы
**Файл:** `questions.js`, массив `QUESTIONS`

Каждый вопрос — объект:
```js
{
  id: 1,
  text: 'Текст вопроса',
  answers: [
    { text: 'Вариант А', score: 3 },  // 3 = максимальная зависимость
    { text: 'Вариант Б', score: 2 },
    { text: 'Вариант В', score: 1 },
    { text: 'Вариант Г', score: 0 },  // 0 = бизнес независим
  ]
}
```

### Результаты (описание, шаги, цвета)
**Файл:** `questions.js`, объект `RESULTS`

Три уровня: `high` (13–18 б), `medium` (7–12 б), `low` (0–6 б).
Для каждого: `title`, `description`, `steps[]`, `color`, `emoji`, `haptic`.

### Telegram-ник для кнопки «Записаться»
**Файл:** `app.js`, константа в начале файла:
```js
const EXPERT_TG_USERNAME = 'nataly_chernyshova';
```

### Счётчик «847 предпринимателей»
**Файл:** `app.js`, константа:
```js
const SOCIAL_PROOF_COUNT = '847';
```

### Фото эксперта
Заменить файл `tg-app/assets/photo.jpg` (80×80 px, квадратное).

### Иконка приветствия
Заменить файл `tg-app/assets/icon.svg` (80×80 px).

---

## Бэкенд (не реализован в MVP)

В `app.js` есть закомментированная функция `sendResultToBackend()`.
После создания сервера раскомментировать и указать URL:
```
POST /api/result
Body: { initData, answers[], score, level, startParam }
```

---

## Тестирование в браузере

При открытии `index.html` не в Telegram:
- Вместо нативных MainButton/BackButton появляются обычные кнопки внутри экрана
- Тема использует светлые фолбэк-значения
- Haptic feedback не срабатывает (нет ошибок, просто тихо)

Для полноценного тестирования использовать BotFather → @BotFather → /newapp
или тестировать через Telegram Desktop с открытыми DevTools (ПКМ → Inspect).
