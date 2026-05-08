import { Link, Text } from 'react-email'

import { EmailLayout } from '@/server/email/templates/layout/EmailLayout'

interface Props {
  receiver: string
  inviter: string
  link: string
}

export function AuthorInvite({ receiver, inviter, link }: Props) {
  return (
    <EmailLayout receiver={receiver}>
      <Text style={paragraph}>
        <strong>{inviter}</strong> 邀请你成为站点的作者。
      </Text>
      <Text style={paragraph}>请点击下方链接设置登录密码（7 天内有效）：</Text>
      <Link href={link} target="_blank" rel="noreferrer" style={primaryLink}>
        {link}
      </Link>
      <Text style={hint}>如果你并未收到此邀请，请忽略此邮件。</Text>
    </EmailLayout>
  )
}

export default AuthorInvite

const paragraph: React.CSSProperties = {
  fontSize: 14,
  color: '#333333',
  lineHeight: 1.5,
  margin: '0 0 10px',
}

const primaryLink: React.CSSProperties = {
  fontSize: 14,
  color: '#008c95',
  textDecoration: 'none',
  wordBreak: 'break-all',
}

const hint: React.CSSProperties = {
  fontSize: 12,
  color: '#666666',
  lineHeight: 1.5,
  margin: '15px 0 0',
}
