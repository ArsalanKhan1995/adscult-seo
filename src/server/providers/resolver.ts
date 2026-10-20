import { seoProviderIdSchema } from "@/types/schemas/seo-provider";
import type {
  ProviderExecution,
  ProviderExecutionReference,
} from "@/server/providers/types";
import { ProviderRepository } from "@/server/providers/repository";
import {
  environmentCredentials,
  openProviderCredentials,
  storedCredentialSourceSchema,
} from "@/server/providers/credentials";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { AppError } from "@/server/lib/errors";

export async function resolveProviderExecution(
  organizationId: string,
  configurationId?: string | null,
  revision?: number,
  retainedProvider?: ProviderExecution["provider"],
): Promise<ProviderExecution> {
  let setting:
    | Awaited<ReturnType<typeof ProviderRepository.settings>>
    | undefined;
  let configuration:
    | Awaited<ReturnType<typeof ProviderRepository.configuration>>
    | undefined;
  try {
    setting =
      configurationId === undefined
        ? await ProviderRepository.settings(organizationId)
        : undefined;
    const id =
      configurationId === undefined
        ? setting?.activeConfigurationId
        : configurationId;
    configuration = id
      ? await ProviderRepository.configuration(organizationId, id)
      : undefined;
    if (id && !configuration) throw new Error("Configuration missing");
  } catch {
    throw new AppError("SEO_PROVIDER_CONFIGURATION_UNAVAILABLE");
  }
  const selected =
    configuration?.provider ??
    retainedProvider ??
    (await getOptionalEnvValue("SEO_PROVIDER")) ??
    "dataforseo";
  const provider = seoProviderIdSchema.safeParse(selected);
  if (!provider.success) throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
  const source = configuration
    ? storedCredentialSourceSchema.parse(configuration.credentialSource)
    : "environment";
  let authorization: string;
  if (source === "database") {
    if (!configuration?.encryptedCredentials || !configuration.keyVersion)
      throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
    authorization = await openProviderCredentials(
      configuration.encryptedCredentials,
      configuration.keyVersion,
    );
  } else {
    authorization = await environmentCredentials(provider.data);
  }
  return Object.freeze({
    organizationId,
    provider: provider.data,
    revision: revision ?? setting?.revision ?? 0,
    credentialVersion: configuration?.id ?? null,
    source,
    authorization,
  });
}

export async function resolveProviderReference(
  organizationId: string,
): Promise<ProviderExecutionReference> {
  const { provider, revision, credentialVersion } =
    await resolveProviderExecution(organizationId);
  return { organizationId, provider, revision, credentialVersion };
}
