import { Link, Text } from 'react-email'

import { EmailLayout } from '@/server/email/templates/layout/EmailLayout'
import { requireBlogSettingsSection } from '@/shared/blog-config'

interface Props {
  receiver: string
  inviterName: string
  acceptLink: string
}

export function AuthorInvite({ receiver, inviterName, acceptLink }: Props) {
  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  return (
    <EmailLayout receiver={receiver}>
      <Text style={paragraph}>
        {inviterName} 邀请您成为《{siteIdentity.title}》的作者。
      </Text>
      <Text style={paragraph}>点击下方链接设置密码并开始写作（链接 7 天内有效）：</Text>
      <Link href={acceptLink} target="_blank" rel="noreferrer" style={primaryLink}>
        {acceptLink}
      </Link>
      <Text style={paragraph}>如果您不认识 {inviterName}，请忽略此邮件。</Text>
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
}
