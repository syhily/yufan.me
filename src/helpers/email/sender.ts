import type { CommentAndUser } from '@/helpers/comment/types'
import type { Comment, Page, User } from '@/helpers/db/types'
import { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_SENDER } from 'astro:env/server'
import Mailgun from 'mailgun.js'
import config from '@/blog.config'
import { parseContent } from '@/helpers/content/markdown'
import { partialRender } from '@/helpers/content/render'
import ApprovedComment from '@/helpers/email/templates/ApprovedComment.astro'
import NewComment from '@/helpers/email/templates/NewComment.astro'
import NewReply from '@/helpers/email/templates/NewReply.astro'

export interface EmailMessage { to: string, subject: string, html: string }

const mailgun = new Mailgun(FormData)
const client = (MAILGUN_API_KEY === undefined || MAILGUN_SENDER === undefined || MAILGUN_DOMAIN === undefined)
  ? undefined
  : mailgun.client({ username: 'api', key: MAILGUN_API_KEY, useFetch: true })

// Send an email using the configured transporter.
async function internalSend(to: string, subject: string, html: string) {
  if (client === undefined) {
    console.error('No SMTP configuration, skip sending message.')
    return
  }
  await client.messages.create(MAILGUN_DOMAIN!, { to, from: MAILGUN_SENDER!, subject, html })
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
  internalSend(config.author.email, `您的网站【${config.title}】有了新评论`, html)
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
  internalSend(sourceUser.email, `您在【${config.title}】的留言有了新回复`, html)
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
  internalSend(user.email, `您在【${config.title}】的留言已经通过审核`, html)
}
