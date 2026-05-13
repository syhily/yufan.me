import { Link, Text } from 'react-email'

import { EmailLayout } from '@/server/email/templates/layout/EmailLayout'
import { requireBlogSettingsSection } from '@/shared/blog-config'

interface Props {
  receiver: string
  resetLink: string
  isFirstPassword: boolean
}

export function PasswordReset({ receiver, resetLink, isFirstPassword }: Props) {
  const siteIdentity = requireBlogSettingsSection('siteIdentity')
  const action = isFirstPassword ? '设置密码' : '重置密码'
  return (
    <EmailLayout receiver={receiver}>
      <Text style={paragraph}>
        您收到了{action}请求
        {isFirstPassword ? '，您的评论已通过审核，现在可以设置密码登录了' : ''}。
      </Text>
      <Text style={paragraph}>点击下方链接{action}（链接 15 分钟内有效）：</Text>
      <Link href={resetLink} target="_blank" rel="noreferrer" style={primaryLink}>
        {resetLink}
      </Link>
      <Text style={paragraph}>如果您没有请求{action}，请忽略此邮件。</Text>
    </EmailLayout>
  )
}

export default PasswordReset

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
