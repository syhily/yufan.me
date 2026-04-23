import { Token } from '@/components/partial/Token'

export interface LoginFormProps {
  action: string
  token?: string
}

export function LoginForm({ action, token }: LoginFormProps) {
  return (
    <form method="post" action={action} id="loginForm">
      <Token token={token} />
      <div className="flex-fill">
        <div className="row g-3 mb-5 px-5">
          <input className="form-control mb-2" placeholder="邮箱" name="email" type="email" required />
          <input
            className="form-control mb-2"
            placeholder="密码"
            name="password"
            type="password"
            required
            minLength={10}
          />
        </div>
        <div className="form-submit text-center">
          <input name="submit" type="submit" id="submit" className="btn btn-primary col-4" value="登陆" />
        </div>
      </div>
    </form>
  )
}
