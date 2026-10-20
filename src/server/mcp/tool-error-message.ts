import { AppError } from "@/server/lib/errors";

/**
 * Error text an agent sees for a failed tool call. An unknown area also tells
 * the agent how to find a valid one, and a provider outage gets the same
 * note that it is the provider's problem, not the request's.
 */
export function toolErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!(error instanceof AppError)) return message;
  if (error.code === "SEO_PROVIDER_UNSUPPORTED")
    return "Not supported by the active provider.";
  if (error.code === "SEO_PROVIDER_QUOTA_EXCEEDED")
    return "The connected SEO provider account has reached its balance or usage limit. Check the provider account.";
  if (error.code === "SEO_PROVIDER_TIMEOUT")
    return "The SEO provider timed out. Check the request status before trying again; it may have been billed.";
  if (error.code === "SEO_PROVIDER_NOT_CONFIGURED")
    return "The active SEO provider is not configured. Ask an administrator to check provider settings.";
  if (error.code === "SEO_PROVIDER_CONFIGURATION_UNAVAILABLE")
    return "Provider settings are temporarily unavailable. Please try again.";
  if (error.code === "UNKNOWN_LOCATION")
    return `${message} Call search_serp_locations and pass the returned locationName exactly.`;
  if (error.code === "UPSTREAM_UNAVAILABLE")
    return `${message} The data provider is temporarily unavailable; this is not a problem with the request.`;
  return message;
}
