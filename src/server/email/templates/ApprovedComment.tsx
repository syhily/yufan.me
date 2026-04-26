import { Link, Text } from 'react-email'

import { EmailLayout } from '@/server/email/templates/layout/EmailLayout'

interface Props {
  receiver: string
  postTitle: string
  postLink: string
  commentContent: string
  commentLink: string
}

export function ApprovedComment({ receiver, postTitle, postLink, commentContent, commentLink }: Props) {
  return (
    <EmailLayout receiver={receiver}>
      <Text style={paragraph}>
        您在《
        <Link href={postLink} style={inlineLink}>
          {postTitle}
        </Link>
        》中的留言，已经通过审核
      </Text>
      <div style={quoteBox}>
        <div style={quoteText} dangerouslySetInnerHTML={{ __html: commentContent }} />
      </div>
      <Text style={paragraph}>您可以打开下方链接查看留言：</Text>
      <Link href={commentLink} target="_blank" rel="noreferrer" style={primaryLink}>
        {commentLink}
      </Link>
    </EmailLayout>
  )
}

export default ApprovedComment

const paragraph: React.CSSProperties = {
  fontSize: 14,
  color: '#333333',
  lineHeight: 1.5,
  margin: '0 0 15px',
}

const inlineLink: React.CSSProperties = {
  color: '#666666',
  textDecoration: 'none',
}

const primaryLink: React.CSSProperties = {
  fontSize: 14,
  color: '#008c95',
  textDecoration: 'none',
}

const quoteBox: React.CSSProperties = {
  background: 'rgba(141,141,141,0.05)',
  borderRadius: 8,
  padding: '10px 15px',
  marginBottom: 15,
}

const quoteText: React.CSSProperties = {
  fontSize: 14,
  color: '#333333',
  lineHeight: 1.7,
}
