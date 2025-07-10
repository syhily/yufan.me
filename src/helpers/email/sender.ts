import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_SECURE, SMTP_SENDER, SMTP_USER } from 'astro:env/server'
import nodemailer from 'nodemailer'

export interface EmailMessage { to: string, from?: string, subject: string, html: string }

export async function send(msg: EmailMessage) {
  // Check SMTP configuration.
  if (SMTP_HOST === undefined || SMTP_PORT === undefined || SMTP_USER === undefined || SMTP_PASSWORD === undefined) {
    console.error('No SMTP configuration, skip sending message.', msg)
    return
  }
  // Set the optional sender.
  if (msg.from === undefined && SMTP_SENDER !== undefined) {
    msg.from = SMTP_SENDER
  }
  // Send mail.
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  })
  await transporter.sendMail(msg)
}
