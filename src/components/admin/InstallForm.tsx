export interface InstallFormProps {
  action: string
}

export function InstallForm({ action }: InstallFormProps) {
  return (
    <form method="post" action={action} id="installForm">
      <div className="flex-fill">
        <div className="row g-3 mb-5 px-5">
          <input className="form-control mb-2" placeholder="昵称" name="name" type="text" required />
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
          <input name="submit" type="submit" id="submit" className="btn btn-primary col-4" value="注册管理员" />
        </div>
      </div>
    </form>
  )
}
