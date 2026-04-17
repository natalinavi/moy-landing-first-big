require("dotenv").config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = 'https://quiz.navi-prolab.ru';
const userSessions = new Map();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const limiter = rateLimit({ windowMs: 60000, max: 20 });
app.use(limiter);

const QUESTIONS = [
  'Сколько решений в вашем бизнесе требуют вашего личного участия?',
  'Что происходит, если вы уезжаете в отпуск на 2 недели?',
  'Где хранятся процессы и знания о вашем бизнесе?',
  'Как часто команда ждёт вас, чтобы начать работу?',
  'Используете ли вы AI-инструменты в работе?',
  'Ваш бизнес может работать без вас как самостоятельный актив?'
];

async function tgSend(chatId, text, keyboard) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/result', async (req, res) => {
  console.log("RESULT REQUEST:", JSON.stringify(req.body).slice(0,200));
  res.json({ success: true });
  try {
    const { initData, answers, totalScore, level, resultTitle, startParam } = req.body;
    let tg_user_id = null, tg_first_name = null, tg_last_name = null, tg_username = null;
    if (!initData && startParam) tg_user_id = parseInt(startParam) || null;
    if (!initData && req.body.uid) tg_user_id = parseInt(req.body.uid) || null;
    try {
      const params = new URLSearchParams(initData);
      const user = JSON.parse(params.get('user') || '{}');
      if (user.id) {
        tg_user_id = user.id;
        tg_first_name = user.first_name;
        tg_last_name = user.last_name;
        tg_username = user.username;
      }
    } catch(e) {}

    await supabase.from('quiz_sessions').insert({
      tg_user_id, tg_first_name, tg_last_name, tg_username,
      total_score: totalScore, level, result_title: resultTitle,
      answers, start_param: startParam
    });

    if (tg_user_id) {
      const levels = {
        high: '🔴 Критическая зависимость',
        medium: '🟡 Зависимость есть — её можно снизить',
        low: '🟢 Хороший задел — следующий шаг: масштаб'
      };
      const name = tg_first_name ? `, ${tg_first_name}` : '';
      let text = `📊 <b>Ваши результаты${name}</b>\n\n`;
      text += `${levels[level]} — ${totalScore} из 18\n\n`;
      text += `<b>Ваши ответы:</b>\n`;
      (answers || []).forEach((a, i) => {
        text += `\n${i+1}. ${QUESTIONS[i]}\n→ ${a.answerText || a.text || '—'}\n`;
      });
      text += `\n\nЧтобы разобрать ситуацию лично — напишите @natalinavi`;
      await tgSend(tg_user_id, text);
    }
  } catch(e) { console.error('Result error:', e); }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, contact, topic } = req.body || {};
    if (!name || !contact) return res.status(400).json({ error: 'name and contact required' });
    await supabase.from('landing_contacts').insert({ name, contact, topic: topic || null });
    res.json({ success: true });
  } catch (e) {
    console.error('Contact error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/webhook', async (req, res) => {
  res.status(200).send('OK');
  try {
    const { message } = req.body || {};
    if (!message) return;
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    const name = message.from?.first_name || '';
    userSessions.set(String(chatId), chatId);
    const quizUrl = `${MINI_APP_URL}?uid=${chatId}`;
    const btn = [[{ text: '🚀 Начать квиз', web_app: { url: quizUrl } }]];
    if (text.startsWith('/start')) {
      await tgSend(chatId, `Привет${name ? `, ${name}` : ''}! 👋\n\nНажми кнопку ниже, чтобы пройти квиз\n\n<i>6 вопросов · 2 минуты · персональный результат</i>`, btn);
    } else {
      await tgSend(chatId, 'Нажми кнопку, чтобы начать квиз 👇', btn);
    }
  } catch(e) { console.error('Webhook error:', e); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
