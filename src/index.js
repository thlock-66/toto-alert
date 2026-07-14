import cron from 'node-cron'
import { fetchTotoData } from './scraper.js'
import { sendTotoAlert } from './telegram.js'

const THRESHOLD = 3_000_000

async function check() {
  try {
    const data = await fetchTotoData()
    const { jackpot, nextDrawDate } = data
    console.log(`Jackpot: $${new Intl.NumberFormat('en-SG').format(jackpot)} — next draw: ${nextDrawDate}`)
    if (jackpot > THRESHOLD) {
      await sendTotoAlert(data)
      console.log('Alert sent!')
    } else {
      console.log(`Below threshold ($${new Intl.NumberFormat('en-SG').format(THRESHOLD)}), no alert.`)
    }
  } catch (err) {
    console.error('Check failed:', err.message)
  }
}

// 01:00 UTC = 09:00 SGT
cron.schedule('0 1 * * *', check)
console.log('TOTO alert running. Next check at 09:00 SGT.')

// Also run immediately on startup
check()
