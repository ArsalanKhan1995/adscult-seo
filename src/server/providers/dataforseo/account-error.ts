/** Shared HTTP and documented vendor status categories, without response text. */
export function dataforseoAccountErrorCode(
  status?: number,
):
  | "DATAFORSEO_AUTH_FAILED"
  | "SEO_PROVIDER_QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | null {
  if (status === 401 || status === 403 || status === 40100)
    return "DATAFORSEO_AUTH_FAILED";
  if (status !== undefined && [402, 40200, 40203, 40210].includes(status))
    return "SEO_PROVIDER_QUOTA_EXCEEDED";
  if (
    status !== undefined &&
    [429, 40202, 40205, 40206, 40209].includes(status)
  )
    return "RATE_LIMITED";
  return null;
}
