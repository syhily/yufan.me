export interface TokenProps {
  token?: string
}

export function Token({ token }: TokenProps) {
  if (!token) return null
  return <input type="hidden" name="token" value={token} />
}
