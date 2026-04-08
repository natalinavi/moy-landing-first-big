/**
 * api/save-results.js — принимает результаты квиза и отправляет их
 * пользователю в личку через Telegram Bot API.
 */

const TOKEN = process.env.BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${TOKEN}`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  res.status(200).json({ ok: true }); // отвечаем сразу

  try {
    const { initData, userId, resultsText } = req.body;
    if (!resultsText) return;

    // Сначала пробуем userId из initDataUnsafe (он надёжнее)
    let chatId = userId;

    // Если userId нет — парсим из initData
    if (!chatId && initData) {
      const params  = new URLSearchParams(initData);
      const userRaw = params.get('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        chatId = user.id;
      }
    }

    if (!chatId) {
      console.error('save-results: no chatId found');
      return;
    }

    await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       `<pre>${resultsText}</pre>`,
        parse_mode: 'HTML',
      }),
    });
  } catch (e) {
    console.error('save-results error:', e);
  }
};
