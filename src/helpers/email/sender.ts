import type { CommentAndUser } from '@/helpers/comment/types'
import type { Comment, Page, User } from '@/helpers/db/types'
import { SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_SECURE, SMTP_SENDER, SMTP_USER } from 'astro:env/server'
import nodemailer from 'nodemailer'
import config from '@/blog.config'
import { parseContent } from '@/helpers/content/markdown'
import { partialRender } from '@/helpers/content/render'
import ApprovedComment from '@/helpers/email/templates/ApprovedComment.astro'
import NewComment from '@/helpers/email/templates/NewComment.astro'
import NewReply from '@/helpers/email/templates/NewReply.astro'

export interface EmailMessage { to: string, subject: string, html: string }

async function internalSend(to: string, subject: string, html: string) {
  // Check SMTP configuration.
  if (SMTP_HOST === undefined || SMTP_PORT === undefined || SMTP_USER === undefined || SMTP_PASSWORD === undefined) {
    console.error('No SMTP configuration, skip sending message.')
    return
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
  await transporter.sendMail({ to, from: SMTP_SENDER, subject, html })
}

// This email is sent for notifying the administrator that his website has a new comment.
export async function sendNewComment(commentInfo: CommentAndUser, page: Page) {
  const html = await partialRender(
    NewComment,
    {
      props: {
        postTitle: page.title,
        postLink: page.key,
        commentNeedApproval: commentInfo.isPending,
        commentContent: await parseContent(commentInfo.content || ''),
        commentLink: `${page.key}#user-comment-${commentInfo.id}`,
      },
    },
  )
  internalSend(config.author.email, `你的网站【${config.title}】有了新评论`, html)
}

// This email is sent only when the user's comment has a reply.
export async function sendNewReply(sourceUser: User, source: Comment, reply: CommentAndUser, page: Page) {
  const html = await partialRender(
    NewReply,
    {
      props: {
        receiver: sourceUser.name,
        postTitle: page.title,
        postLink: page.key,
        sourceContent: await parseContent(source.content || ''),
        replyContent: await parseContent(reply.content || ''),
        replyLink: `${page.key}#user-comment-${reply.id}`,
      },
    },
  )
  internalSend(sourceUser.email, `你在【${config.title}】的留言有了新回复`, html)
}

// This email is sent only when the user's pending comment get approved.
export async function sendApprovedComment(comment: Comment, user: User, page: Page) {
  const html = await partialRender(
    ApprovedComment,
    {
      props: {
        receiver: user.name,
        postTitle: page.title,
        postLink: page.key,
        commentContent: await parseContent(comment.content || ''),
        commentLink: `${page.key}#user-comment-${comment.id}`,
      },
    },
  )
  internalSend(user.email, `你在【${config.title}】的留言已经通过审核`, html)
}
