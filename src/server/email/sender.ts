import { createElement } from 'react'
import { render } from 'react-email'

import type { CommentAndUser } from '@/server/comments/types'
import type { EntityTarget } from '@/server/db/target'
import type { Comment, User } from '@/server/db/types'

import { entityCommentUrl, findEntitySlugTitle } from '@/server/comments/url'
import ApprovedComment from '@/server/email/templates/ApprovedComment'
import AuthorInvite from '@/server/email/templates/AuthorInvite'
import NewComment from '@/server/email/templates/NewComment'
import NewReply from '@/server/email/templates/NewReply'
import PasswordReset from '@/server/email/templates/PasswordReset'
import { getLogger } from '@/server/logger'
import { commentBodyToHtml } from '@/server/pt/comment-to-html'
import { requireBlogSettingsSection } from '@/shared/blog-config'

const log = getLogger('email')

export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export type SendResult =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'unconfigured'; message: string }
  | { ok: false; reason: 'upstream'; status: number; message: string }
  | { ok: false; reason: 'network'; message: string }

interface MailConfig {
  enabled: boolean
  host: string
  apiKey: string
  sender: string
}

// Read the live mail slice straight from the snapshot. Mail senders only
// run from server-side code paths that already sit behind the install
// gate, so `requireBlogSettingsSection()` is the right call — a `null`
// here would be a regression in the gate, not a runtime mode we need to
// support.
function readMailConfig(): MailConfig {
  return requireBlogSettingsSection('mail').mail
}

// Single source of truth for "should this notification actually fire?"
// — used both internally by the comment-fired senders below and by the
// admin "send test" action so the UI can surface the same skip reason.
function checkMailReady(
  mail: MailConfig,
): { ready: true } | { ready: false; reason: 'disabled' | 'unconfigured'; message: string } {
  if (!mail.enabled) {
    return { ready: false, reason: 'disabled', message: '邮件发送已在管理面板中关闭' }
  }
  if (!mail.host || !mail.apiKey || !mail.sender) {
    return {
      ready: false,
      reason: 'unconfigured',
      message: '邮件服务尚未配置完整（缺少 Host / API Key / 发件人）',
    }
  }
  return { ready: true }
}

interface InternalSendOptions {
  /** Optional BCC list. Used by admin-author-invite to keep the inviter on the audit trail. */
  bcc?: string[]
}

async function internalSend(
  to: string,
  subject: string,
  html: string,
  options: InternalSendOptions = {},
): Promise<SendResult> {
  const mail = readMailConfig()
  const ready = checkMailReady(mail)
  if (!ready.ready) {
    // Skip path used to be an `error`-level log because the only way
    // to land here was a misconfigured deployment. Now that an editor
    // can intentionally pause notifications, the disabled branch is
    // demoted to `debug` and the unconfigured branch stays `warn` so
    // it's still visible in CI / production logs.
    if (ready.reason === 'disabled') {
      log.debug('Mail send skipped: disabled', { to, subject })
    } else {
      log.warn('Mail send skipped: unconfigured', { to, subject })
    }
    return { ok: false, reason: ready.reason, message: ready.message }
  }

  const url = `https://${mail.host}/api/v1/zsend/emails`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mail.apiKey}`,
      },
      body: JSON.stringify({
        from: mail.sender,
        to: [to],
        ...(options.bcc && options.bcc.length > 0 ? { bcc: options.bcc } : {}),
        subject,
        html,
      }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('Mail send failed: network error', { to, subject, error })
    return { ok: false, reason: 'network', message }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    log.error('Mail send failed: upstream rejected', {
      status: response.status,
      statusText: response.statusText,
      body,
      to,
      subject,
    })
    return {
      ok: false,
      reason: 'upstream',
      status: response.status,
      message: `${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
    }
  }
  return { ok: true }
}

async function resolveEntity(target: EntityTarget): Promise<{ title: string; url: string } | null> {
  const entity = await findEntitySlugTitle(target)
  if (entity === null) {
    return null
  }
  return { title: entity.title, url: entityCommentUrl(target.type, entity.slug) }
}

// Sent to the administrator whenever a new comment is posted.
export async function sendNewComment(commentInfo: CommentAndUser, target: EntityTarget): Promise<SendResult> {
  const entity = await resolveEntity(target)
  const commentHtml = commentBodyToHtml(commentInfo.body)
  if (entity === null) {
    log.warn('Skipping new-comment email: target entity not found', { target })
    return { ok: false, reason: 'unconfigured', message: '评论目标已不存在' }
  }
  const html = await render(
    createElement(NewComment, {
      postTitle: entity.title,
      postLink: entity.url,
      commentNeedApproval: commentInfo.isPending === true,
      commentContent: commentHtml,
      commentLink: `${entity.url}#user-comment-${commentInfo.id}`,
    }),
  )
  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  return internalSend(siteIdentity.author.email, `您的网站【${siteIdentity.title}】有了新评论`, html)
}

// Sent to the original commenter when one of their comments receives a reply.
export async function sendNewReply(
  sourceUser: User,
  source: Comment,
  reply: CommentAndUser,
  target: EntityTarget,
): Promise<SendResult> {
  const entity = await resolveEntity(target)
  const sourceHtml = commentBodyToHtml(source.body)
  const replyHtml = commentBodyToHtml(reply.body)
  if (entity === null) {
    log.warn('Skipping reply email: target entity not found', { target })
    return { ok: false, reason: 'unconfigured', message: '评论目标已不存在' }
  }
  const html = await render(
    createElement(NewReply, {
      receiver: sourceUser.name,
      postTitle: entity.title,
      postLink: entity.url,
      sourceContent: sourceHtml,
      replyContent: replyHtml,
      replyLink: `${entity.url}#user-comment-${reply.id}`,
    }),
  )
  return internalSend(
    sourceUser.email,
    `您在【${requireBlogSettingsSection('siteIdentity').title}】的留言有了新回复`,
    html,
  )
}

// Sent to a newly invited author with a setup link. The inviter is
// BCC'd so admin actions stay on the audit trail (the recipient does
// not see the BCC).
export async function sendAuthorInvite(
  user: User,
  link: string,
  inviterName: string,
  inviterEmail?: string,
): Promise<SendResult> {
  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  const html = await render(
    createElement(AuthorInvite, {
      receiver: user.name,
      inviter: inviterName,
      link,
    }),
  )
  return internalSend(user.email, `【${siteIdentity.title}】作者邀请`, html, {
    bcc: inviterEmail ? [inviterEmail] : undefined,
  })
}

// Sent when a user requests a password reset.
export async function sendPasswordReset(user: User, link: string): Promise<SendResult> {
  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  const html = await render(
    createElement(PasswordReset, {
      receiver: user.name,
      link,
    }),
  )
  return internalSend(user.email, `【${siteIdentity.title}】密码重置`, html)
}

// Sent to the commenter when an admin approves their previously pending comment.
export async function sendApprovedComment(comment: Comment, user: User, target: EntityTarget): Promise<SendResult> {
  const entity = await resolveEntity(target)
  const commentHtml = commentBodyToHtml(comment.body)
  if (entity === null) {
    log.warn('Skipping approval email: target entity not found', { target })
    return { ok: false, reason: 'unconfigured', message: '评论目标已不存在' }
  }
  const html = await render(
    createElement(ApprovedComment, {
      receiver: user.name,
      postTitle: entity.title,
      postLink: entity.url,
      commentContent: commentHtml,
      commentLink: `${entity.url}#user-comment-${comment.id}`,
    }),
  )
  return internalSend(user.email, `您在【${requireBlogSettingsSection('siteIdentity').title}】的留言已经通过审核`, html)
}

// Sent on demand from the admin "测试发送" button. Bypasses the
// `enabled` master switch on purpose: an editor needs to verify the
// connection to upstream BEFORE flipping the public toggle. The
// `unconfigured` guard still applies — there's no point round-tripping
// to Zeabur with an empty key.
export async function sendTestMail(to: string): Promise<SendResult> {
  const mail = readMailConfig()
  if (!mail.host || !mail.apiKey || !mail.sender) {
    log.warn('Test mail skipped: unconfigured', { to })
    return {
      ok: false,
      reason: 'unconfigured',
      message: '邮件服务尚未配置完整（缺少 Host / API Key / 发件人）',
    }
  }

  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  const subject = `【${siteIdentity.title}】管理员邮件测试`
  const sentAt = new Date().toISOString()
  // Keep the test body intentionally plain (no React Email render) so a
  // failure here points at the SMTP/HTTP plumbing rather than the
  // template renderer.
  const html = [
    `<p>这是一封来自 <strong>${escapeHtml(siteIdentity.title)}</strong> 后台的邮件发送测试。</p>`,
    `<p>如果你收到了这封邮件，说明 Zeabur ZSend 配置工作正常。</p>`,
    `<ul>`,
    `<li>站点：${escapeHtml(siteIdentity.website)}</li>`,
    `<li>发件人：${escapeHtml(mail.sender)}</li>`,
    `<li>触发时间（UTC）：${sentAt}</li>`,
    `</ul>`,
  ].join('\n')

  // Send through a direct fetch instead of `internalSend` so we report
  // the upstream status verbatim — the admin UI surfaces it for
  // troubleshooting.
  const url = `https://${mail.host}/api/v1/zsend/emails`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mail.apiKey}`,
      },
      body: JSON.stringify({ from: mail.sender, to: [to], subject, html }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('Test mail send failed: network error', { to, error })
    return { ok: false, reason: 'network', message }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    log.error('Test mail send failed: upstream rejected', {
      status: response.status,
      statusText: response.statusText,
      body,
      to,
    })
    return {
      ok: false,
      reason: 'upstream',
      status: response.status,
      message: `${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
    }
  }
  return { ok: true }
}

// Tiny escape used only by the test-mail HTML — the comment templates
// already run through React Email which handles escaping for us.
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
