// Error class thrown by `unwrap` when a ts-rest call returns a
// non-2xx response. The `message` / `status` / `issues` triplet
// mirrors the wire envelope declared by `shared/contracts/_errors`,
// so call sites can branch on `err.status` (e.g. 401 → redirect to
// /wp-login.php, 403 → toast permission message) without re-parsing
// the body.

export class ApiError extends Error {
  readonly status: number
  readonly issues?: { message: string; path?: string[] }[]

  constructor(message: string, status: number, issues?: { message: string; path?: string[] }[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.issues = issues
  }
}
