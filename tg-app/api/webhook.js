/**
 * api/webhook.js — Vercel Serverless Function (CommonJS)
 * Принимает обновления от Telegram и отвечает на /start, /help, /contact
 */

const TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = 'https://tg-app-ashy.vercel.app';
const TG_API = `https://api.telegram.org/bot${TOKEN}`;

async function sendMessage(chatId, text, inlineKeyboard) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (inlineKeyboard) {
    body.reply_markup = { inline_keyboard: inlineKeyboard };
  }
  const resp = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  // Отвечаем Telegram сразу — не ждём выполнения sendMessage.
  // Это предотвращает ошибку таймаута при холодном старте.
  res.status(200).send('OK');

  try {
    const update = req.body;
    const message = update && update.message;
    if (!message) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text   = (message.text || '').trim();
    const name   = (message.from && message.from.first_name) ? message.from.first_name : '';

    if (text.startsWith('/start')) {
      await sendMessage(
        chatId,
        `Привет${name ? `, ${name}` : ''}! 👋\n\nНажми кнопку ниже, чтобы пройти квиз «Держится ли ваш бизнес на системе или на вас?»\n\n<i>6 вопросов · 2 минуты · персональный результат</i>`,
        [[{ text: '🚀 Начать квиз', web_app: { url: MINI_APP_URL } }]]
      );
    } else if (text.startsWith('/help')) {
      await sendMessage(
        chatId,
        `<b>Как это работает:</b>\n\n1. Нажмите «Начать квиз» ниже\n2. Ответьте на 6 коротких вопросов\n3. Получите персональный разбор ситуации\n\nВопросы? Пишите @natalinavi`,
        [[{ text: '▶️ Начать квиз', web_app: { url: MINI_APP_URL } }]]
      );
    } else if (text.startsWith('/contact')) {
      await sendMessage(
        chatId,
        `Связаться с Наталией Чернышовой:\n👉 @natalinavi`,
        null
      );
    } else {
      // На любое другое сообщение — тоже показываем кнопку
      await sendMessage(
        chatId,
        `Нажми кнопку, чтобы начать квиз 👇`,
        [[{ text: '🚀 Начать квиз', web_app: { url: MINI_APP_URL } }]]
      );
    }
  } catch (e) {
    console.error('Webhook error:', e);
  }

  return res.status(200).send('OK');
};
