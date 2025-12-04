/**
 * Common error messages used across the application
 */
export const ErrorMessages = {
  // Authentication errors
  NOT_ADMIN: '当前用户不是管理员。',
  NOT_ADMIN_SYSTEM: '系统错误，当前用户不是管理员。',
  SESSION_NOT_CONFIGURED: 'Astro 会话未正确配置。',
  INVALID_CREDENTIALS: '登录凭证无效。',
  TOO_MANY_REQUESTS: '请求过于频繁，请稍后再试',
  TOO_MANY_LOGIN_ATTEMPTS: '登录失败次数过多，已锁定 30 分钟',
  PASSWORD_MISMATCH: '密码和确认密码不匹配',
  EMAIL_ALREADY_REGISTERED: '该邮箱已被注册，请使用登录功能',
  REGISTRATION_FAILED: '注册成功，但自动登录失败，请手动登录',

  // Comment errors
  COMMENT_NOT_FOUND: '评论不存在',
  COMMENT_UPDATE_FAILED: '更新评论失败',
  COMMENT_PAGE_NOT_FOUND: '系统错误，评论的目标页面不存在。',
  COMMENT_USER_CREATE_FAILED: '系统错误，用户创建失败。',
  COMMENT_CREATE_FAILED: '系统错误，评论创建失败。',
  COMMENT_DUPLICATE: '重复评论，你已经有了相同的留言，如果在页面看不到，说明它正在等待站长审核。',
  COMMENT_ADMIN_REQUIRED: '管理员账号需要登陆才能评论。',
  COMMENT_EMAIL_MISMATCH: '评论邮箱与登陆账号不相符。',
  COMMENT_LOGIN_REQUIRED: '该邮箱已经注册，请登录后再进行评论留言。',
  COMMENT_SERVER_ERROR: '无法连接到评论服务器',

  // Admin errors
  INSTALLATION_DONE: '安装已完成',
  ADMIN_CREATE_FAILED: '创建管理员账号失败',
} as const
