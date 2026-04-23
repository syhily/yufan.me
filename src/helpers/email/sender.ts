import { ZEABUR_MAIL_HOST, ZEABUR_MAIL_API_KEY, ZEABUR_MAIL_SENDER } from 'astro:env/server'

import type { CommentAndUser } from '@/helpers/comment/types'
import type { Comment, Page, User } from '@/helpers/db/types'

import config from '@/blog.config'
import { parseContent } from '@/helpers/content/markdown'
import { partialRender } from '@/helpers/content/render'
import ApprovedComment from '@/helpers/email/templates/ApprovedComment.astro'
import NewComment from '@/helpers/email/templates/NewComment.astro'
import NewReply from '@/helpers/email/templates/NewReply.astro'
import { getLogger } from '@/helpers/logger'

const log = getLogger('email')

export interface EmailMessage {
  to: string
  subject: string
  html: string
}

const ZEABUR_MAIL_BASE_URL = `https://${ZEABUR_MAIL_HOST}/api/v1/zsend`

// Send an email using the configured transporter.
async function internalSend(to: string, subject: string, html: string) {
  if (ZEABUR_MAIL_API_KEY === undefined || ZEABUR_MAIL_API_KEY === '') {
    log.error('No Zeabur mail API key configured, skip sending message.', { to, subject })
    return
  }

  const response = await fetch(`${ZEABUR_MAIL_BASE_URL}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZEABUR_MAIL_API_KEY}`,
    },
    body: JSON.stringify({
      from: ZEABUR_MAIL_SENDER,
      to: [to],
      subject,
      html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    log.error('Failed to send email via Zeabur', {
      status: response.status,
      statusText: response.statusText,
      body,
      to,
    })
  }
}

// This email is sent for notifying the administrator that his website has a new comment.
export async function sendNewComment(commentInfo: CommentAndUser, page: Page) {
  const html = await partialRender(NewComment, {
    props: {
      postTitle: page.title,
      postLink: page.key,
      commentNeedApproval: commentInfo.isPending,
      commentContent: await parseContent(commentInfo.content || ''),
      commentLink: `${page.key}#user-comment-${commentInfo.id}`,
    },
  })
  await internalSend(config.author.email, `您的网站【${config.title}】有了新评论`, html)
}

// This email is sent only when the user's comment has a reply.
export async function sendNewReply(sourceUser: User, source: Comment, reply: CommentAndUser, page: Page) {
  const html = await partialRender(NewReply, {
    props: {
      receiver: sourceUser.name,
      postTitle: page.title,
      postLink: page.key,
      sourceContent: await parseContent(source.content || ''),
      replyContent: await parseContent(reply.content || ''),
      replyLink: `${page.key}#user-comment-${reply.id}`,
    },
  })
  await internalSend(sourceUser.email, `您在【${config.title}】的留言有了新回复`, html)
}

// This email is sent only when the user's pending comment get approved.
export async function sendApprovedComment(comment: Comment, user: User, page: Page) {
  const html = await partialRender(ApprovedComment, {
    props: {
      receiver: user.name,
      postTitle: page.title,
      postLink: page.key,
      commentContent: await parseContent(comment.content || ''),
      commentLink: `${page.key}#user-comment-${comment.id}`,
    },
  })
  await internalSend(user.email, `您在【${config.title}】的留言已经通过审核`, html)
}
