import { z } from "zod";

export const seoProviderIdSchema = z.enum(["dataforseo", "treg"]);
export type SeoProviderId = z.infer<typeof seoProviderIdSchema>;

export const providerCandidateSchema = z.object({
  provider: seoProviderIdSchema,
  selection: z.enum(["explicit", "environment"]).default("explicit"),
  credentials: z.discriminatedUnion("action", [
    z.object({ action: z.literal("unchanged") }),
    z.object({ action: z.literal("environment") }),
    z.object({
      action: z.literal("replace"),
      bundle: z.discriminatedUnion("provider", [
        z.object({
          provider: z.literal("dataforseo"),
          login: z
            .string()
            .trim()
            .min(1)
            .max(320)
            .refine((v) => !v.includes(":")),
          password: z.string().min(1).max(1024),
        }),
        z.object({
          provider: z.literal("treg"),
          token: z.string().trim().min(1).max(4096),
        }),
      ]),
    }),
  ]),
});

export const activateProviderSchema = z.object({
  candidateId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
});

export const testProviderSchema = z.object({ candidateId: z.string().uuid() });
