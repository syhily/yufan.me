import { render } from '@react-email/render'
import { ZEABUR_MAIL_HOST, ZEABUR_MAIL_API_KEY, ZEABUR_MAIL_SENDER } from 'astro:env/server'
import { createElement } from 'react'

import type { Comment, Page, User } from '@/db/types'
import type { CommentAndUser } from '@/services/comments/types'

import config from '@/blog.config'
import ApprovedComment from '@/services/email/templates/ApprovedComment'
import NewComment from '@/services/email/templates/NewComment'
import NewReply from '@/services/email/templates/NewReply'
import { parseContent } from '@/services/markdown/parser'
import { getLogger } from '@/shared/logger'

const log = getLogger('email')

export interface EmailMessage {
  to: string
  subject: string
  html: string
}

const ZEABUR_MAIL_BASE_URL = `https://${ZEABUR_MAIL_HOST}/api/v1/zsend`

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

// Sent to the administrator whenever a new comment is posted.
export async function sendNewComment(commentInfo: CommentAndUser, page: Page) {
  const html = await render(
    createElement(NewComment, {
      postTitle: page.title,
      postLink: page.key,
      commentNeedApproval: commentInfo.isPending === true,
      commentContent: await parseContent(commentInfo.content || ''),
      commentLink: `${page.key}#user-comment-${commentInfo.id}`,
    }),
  )
  await internalSend(config.author.email, `您的网站【${config.title}】有了新评论`, html)
}

// Sent to the original commenter when one of their comments receives a reply.
export async function sendNewReply(sourceUser: User, source: Comment, reply: CommentAndUser, page: Page) {
  const html = await render(
    createElement(NewReply, {
      receiver: sourceUser.name,
      postTitle: page.title,
      postLink: page.key,
      sourceContent: await parseContent(source.content || ''),
      replyContent: await parseContent(reply.content || ''),
      replyLink: `${page.key}#user-comment-${reply.id}`,
    }),
  )
  await internalSend(sourceUser.email, `您在【${config.title}】的留言有了新回复`, html)
}

// Sent to the commenter when an admin approves their previously pending comment.
export async function sendApprovedComment(comment: Comment, user: User, page: Page) {
  const html = await render(
    createElement(ApprovedComment, {
      receiver: user.name,
      postTitle: page.title,
      postLink: page.key,
      commentContent: await parseContent(comment.content || ''),
      commentLink: `${page.key}#user-comment-${comment.id}`,
    }),
  )
  await internalSend(user.email, `您在【${config.title}】的留言已经通过审核`, html)
}
