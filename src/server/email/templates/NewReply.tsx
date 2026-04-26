import { Link, Text } from 'react-email'

import { EmailLayout } from '@/server/email/templates/layout/EmailLayout'

interface Props {
  receiver: string
  postTitle: string
  postLink: string
  sourceContent: string
  replyContent: string
  replyLink: string
}

export function NewReply({ receiver, postTitle, postLink, sourceContent, replyContent, replyLink }: Props) {
  return (
    <EmailLayout receiver={receiver}>
      <Text style={paragraph}>
        您在《
        <Link href={postLink} style={inlineLink}>
          {postTitle}
        </Link>
        》中的留言，有了新回复
      </Text>
      <Text style={label}>您的留言：</Text>
      <div style={quoteBox}>
        <div style={quoteText} dangerouslySetInnerHTML={{ __html: sourceContent }} />
      </div>
      <Text style={label}>回复内容：</Text>
      <div style={quoteBox}>
        <div style={quoteText} dangerouslySetInnerHTML={{ __html: replyContent }} />
      </div>
      <Text style={paragraph}>您可以打开下方链接查看留言：</Text>
      <Link href={replyLink} target="_blank" rel="noreferrer" style={primaryLink}>
        {replyLink}
      </Link>
    </EmailLayout>
  )
}

export default NewReply

const paragraph: React.CSSProperties = {
  fontSize: 14,
  color: '#333333',
  lineHeight: 1.5,
  margin: '0 0 10px',
}

const label: React.CSSProperties = {
  fontSize: 14,
  color: '#333333',
  lineHeight: 1.5,
  margin: '0 0 5px',
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
