import { dataforseoAdapter } from "@/server/providers/dataforseo/adapter";
import { tregAdapter } from "@/server/providers/treg/adapter";
import { seoProviderIdSchema } from "@/types/schemas/seo-provider";
import { AppError } from "@/server/lib/errors";

export function getProviderAdapter(provider: unknown) {
  const parsed = seoProviderIdSchema.safeParse(provider);
  if (!parsed.success) throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
  return parsed.data === "dataforseo" ? dataforseoAdapter : tregAdapter;
}
