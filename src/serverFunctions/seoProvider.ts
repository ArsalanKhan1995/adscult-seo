import { createServerFn } from "@tanstack/react-start";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { ProviderSettingsService } from "@/server/features/settings/provider-settings";
import {
  providerCandidateSchema,
  testProviderSchema,
  activateProviderSchema,
} from "@/types/schemas/seo-provider";

export const getProviderSettings = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => ProviderSettingsService.read(context));

export const saveProviderCandidate = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(providerCandidateSchema)
  .handler(({ context, data }) =>
    ProviderSettingsService.saveCandidate(context, data),
  );

export const testProviderCandidate = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(testProviderSchema)
  .handler(({ context, data }) =>
    ProviderSettingsService.testCandidate(context, data.candidateId),
  );

export const activateProviderCandidate = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(activateProviderSchema)
  .handler(({ context, data }) =>
    ProviderSettingsService.activate(
      context,
      data.candidateId,
      data.expectedRevision,
    ),
  );
