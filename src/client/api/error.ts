/**
 * Typed API error thrown by `unwrap()` when a ts-rest response carries
 * a non-2xx status code.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: { message: string; path?: string[] }[],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
