import { data } from 'react-router'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { issueCsrfToken } from '@/server/domains/auth/csrf'
import { processAuthFormSubmission, signUpInitialAdminWithSession } from '@/server/domains/auth/flows'
import { signUpAdminSchema } from '@/server/domains/auth/schema'
import { ensureNoAdminOrRedirect } from '@/server/domains/settings/install-gate'
import { bundleFromMatches, routeMeta } from '@/server/render/seo/meta'
import { AdminInstallForm } from '@/ui/admin/auth/AdminInstallForm'

import type { Route } from './+types/index'

const ADMIN_INSTALL_FIELDS = ['title', 'name', 'email', 'password', 'csrf'] as const

export async function loader({ request, context }: Route.LoaderArgs) {
  // owns the install-state branching directly through
  // `ensureNoAdminOrRedirect()`. Possible outcomes:
  //
  //   noAdmin    → render the admin-credentials form.
  //   noSettings → 303 → /admin/setup/settings
  //   installed  → 303 → /admin/signin
  await ensureNoAdminOrRedirect()

  // Pull the request context so we trip session middleware exactly once
  // even though we no longer write the CSRF token through the session.
  getRouteRequestContext({ request, context })
  const { token: csrf, setCookie } = await issueCsrfToken(request)
  return data({ csrf }, { headers: { 'Set-Cookie': setCookie } })
}

export async function action({ request, context }: Route.ActionArgs) {
  // Same gate as the loader. A POST that races a concurrent install
  // would still be caught by `signUpInitialAdminWithSession`'s own
  // `hasAdmin()` check (returns 409), so the redirect here is a UX
  // courtesy, not a security boundary.
  await ensureNoAdminOrRedirect()

  const { session, clientAddress } = getRouteRequestContext({ request, context })
  return processAuthFormSubmission({
    request,
    schema: signUpAdminSchema,
    fields: ADMIN_INSTALL_FIELDS,
    defaultErrorMessage: '请填写完整的管理员账号信息。',
    redirectTo: undefined,
    run: (input) => signUpInitialAdminWithSession({ ...input, session, request, clientAddress }),
  })
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: 'Welcome' }, bundleFromMatches(matches))
}

export default function AdminInstallRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Ghost-style welcome header */}
      <header className="text-center">
        <img src="/logo-large.svg" alt="且听书吟" className="mx-auto mb-4 block h-16 w-auto dark:hidden" />
        <img src="/logo-large-dark.svg" alt="" className="mx-auto mb-4 hidden h-16 w-auto dark:block" aria-hidden />
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Welcome to 且听书吟.</h1>
        <p className="mt-2 text-base text-muted-foreground md:text-lg">
          世界各地的人已经创建了无数精彩的站点。今天，我们将开启属于你的旅程。
        </p>
      </header>

      {/* Error message — centered, Ghost-style */}
      {actionData?.error && (
        <div role="alert" aria-live="polite" className="text-center text-sm leading-relaxed text-destructive">
          {actionData.error}
        </div>
      )}

      <AdminInstallForm csrf={loaderData.csrf} />
    </div>
  )
}
