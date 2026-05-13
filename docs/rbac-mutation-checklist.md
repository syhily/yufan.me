# RBAC mutation endpoint checklist

Every server-side mutation that affects authenticated state — user
roles, sessions, content ownership, credential-rotating flows — must
satisfy each of the following five before it ships. The columns are
listed in the order an attacker would probe them.

> 这个清单源于 `RBAC-REVIEW.md` 的事后总结。把每条 mutation 都过一遍，
> 然后把答案写到 PR 描述里（即使是 N/A），评审才知道你想过这些事。

| #   | 项                 | 说明                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **CSRF**           | JSON-only endpoints rely on the `useApiFetcher` CSRF header; form-encoded endpoints (`<Form>` POST) MUST validate the `csrf` field explicitly with `validateRequestCsrf`. Reset / accept-invite paths are easy to overlook — they're not in the `processAuthFormSubmission` envelope and need the call by hand.                                                     |
| 2   | **Rate-limit**     | Any side-effect that costs upstream quota (email, S3, third-party API) needs a rate-limit bucket. Pick the right scope: per-IP for public surfaces, per-actor for admin operations, per-**target** for admin-triggered "act on someone else" flows (e.g. `admin.sendPasswordReset`).                                                                                |
| 3   | **Audit log**      | After a successful mutation, write a line through `getLogger('audit.<domain>')`. Today these are stdout-only — see `src/server/logger.ts` for the durable-sink TODO. Even so, the line is the trace that lets a forensic read reconstruct who-did-what when the durable table lands.                                                                                |
| 4   | **Session revoke** | If the mutation changes the **role** or the **credential** of any user (password reset, role change, soft delete, mute → un-mute that elevates a previously suppressed account), call `revokeAllSessionsOfUser(targetId)` afterwards. For self-service password change, pass `exceptSessionId: ctx.session.id` so the current tab stays alive.                      |
| 5   | **Rollback**       | When the mutation crosses an external boundary (SMTP, S3, third-party API), the DB write and the external call must succeed-or-fail together. Wrap the path so a failed email rolls back the user row (`admin.inviteAuthor`), a failed S3 PUT rolls back the image row, etc. Without it, retries fail with «already exists» and operators have to clean up by hand. |

## Worked examples

- **`admin.updateUserRole`**: ✅ CSRF via fetcher · N/A rate-limit (admin already gated) · ✅ audit · ✅ revoke · N/A rollback.
- **`admin.sendPasswordReset`**: ✅ CSRF via fetcher · ✅ per-target rate-limit · ✅ audit · N/A revoke (no role change yet) · ⚠️ no rollback: token is issued before email send, so a failed email leaves a stale token. Acceptable today because the next admin-issued reset overwrites it via `ON CONFLICT (purpose, user_id) DO UPDATE`.
- **`admin.inviteAuthor`**: ✅ CSRF via fetcher · ✅ per-IP rate-limit · ✅ audit (success / rollback distinguished) · N/A revoke (new account) · ✅ rollback: failed email triggers `softDeleteUserById` + `revokeTokensFor`.
- **`wp-login` reset / accept-invite**: ✅ CSRF validated explicitly · ✅ token consumption is the rate-limit (one-shot) · ⚠️ audit not yet wired · ✅ revoke (via `establishLoginSession({ revokeOtherSessions: true })`) · N/A rollback.
- **`admin.softDeleteUser`**: ✅ CSRF via fetcher · N/A rate-limit · ✅ audit · ✅ revoke · N/A rollback (no external side effect).

## When in doubt

Open the route file alongside `RBAC-REVIEW.md` and confirm the
review's O / D / F notes don't apply. If they do, fix them at the
same time — the cost of fixing one mutation in isolation is much
lower than fixing six at once.
