export async function sendTotoAlert({ jackpot, nextDrawDate }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env var')
  const amount = '$' + new Intl.NumberFormat('en-SG').format(jackpot)
  const text = `TOTO jackpot is ${amount}! Next draw: ${nextDrawDate}`

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) throw new Error(`Telegram API error: ${res.status}`)
}
