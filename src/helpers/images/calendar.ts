import type { DateTime } from 'luxon'
import type { Buffer } from 'node:buffer'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { Solar } from 'lunar-typescript'
import { compressImage, oppoSerif } from '@/helpers/images/assets'

const WIDTH = 600
const HEIGHT = 880

if (!GlobalFonts.has('OPPOSerif')) {
  GlobalFonts.register(oppoSerif(), 'OPPOSerif')
}

async function fetchDailyQuote(date: DateTime) {
  const url = `https://apiv3.shanbay.com/weapps/dailyquote/quote?date=${date.toFormat('yyyy-MM-dd')}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API 请求失败: ${res.status}`)
  }
  return res.json() as Promise<{ content: string, translation: string, author: string }>
}

function getMonthLabel(date: DateTime) {
  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return months[date.month - 1]
}

function getWeekdayLabel(date: DateTime) {
  const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
  return weekdays[date.weekday - 1]
}

function getLunarLabel(date: DateTime) {
  const solar = Solar.fromYmd(date.year, date.month, date.day)
  const lunar = solar.getLunar()
  return `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
}

function getDailyAuspiciousLabel(date: DateTime) {
  const solar = Solar.fromYmd(date.year, date.month, date.day)
  const lunar = solar.getLunar()
  const auspicious = lunar.getDayYi()
  return `宜${auspicious[Math.floor(date.day % auspicious.length)]}`
}

function wrapText(ctx: any, text: string, maxWidth: number) {
  const words = text.split('')
  const lines: string[] = []
  let line = ''
  for (const ch of words) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line)
      line = ch
    }
    else {
      line = test
    }
  }
  if (line)
    lines.push(line)
  return lines
}

export async function renderCalendar(date: DateTime): Promise<Buffer> {
  // Generate the required data from date.
  const quoteData = await fetchDailyQuote(date)
  const monthText = getMonthLabel(date)
  const lunarText = getLunarLabel(date)
  const weekday = getWeekdayLabel(date)
  const dailyAuspicious = getDailyAuspiciousLabel(date)

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 4
  ctx.strokeRect(12, 12, WIDTH - 24, HEIGHT - 24)

  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'middle'
  ctx.font = '28px OPPOSerif'
  ctx.textAlign = 'left'

  ctx.fillText(monthText, 36, 50)

  ctx.textAlign = 'center'
  ctx.fillText(lunarText, WIDTH / 2, 50)

  ctx.textAlign = 'right'
  ctx.fillText(weekday, WIDTH - 36, 50)

  ctx.beginPath()
  ctx.moveTo(36, 80)
  ctx.lineTo(WIDTH - 36, 80)
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '400px OPPOSerif'
  const dayY = 320
  ctx.fillText(String(date.day), WIDTH / 2, dayY)

  ctx.font = '50px OPPOSerif'
  const auspiciousY = dayY + 220
  ctx.fillText(dailyAuspicious, WIDTH / 2, auspiciousY)

  const quoteStartY = auspiciousY + 60
  ctx.beginPath()
  ctx.moveTo(36, quoteStartY)
  ctx.lineTo(WIDTH - 36, quoteStartY)
  ctx.lineWidth = 1.5
  ctx.stroke()

  const quoteY = quoteStartY + 40
  const maxTextWidth = WIDTH - 72

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = '36px OPPOSerif'
  const quoteText = `${quoteData.translation}`
  const quoteLines = wrapText(ctx, quoteText, maxTextWidth)
  let y = quoteY
  const lineHeight = 56

  for (const line of quoteLines) {
    ctx.fillText(line, 36, y)
    y += lineHeight
  }

  y += 30
  ctx.font = '24px OPPOSerif'
  ctx.textAlign = 'right'
  const authorText = quoteData.author || ''
  ctx.fillText(authorText, WIDTH - 36, HEIGHT - 50)

  const encodedImage = await canvas.encode('png')
  return await compressImage(encodedImage)
}
