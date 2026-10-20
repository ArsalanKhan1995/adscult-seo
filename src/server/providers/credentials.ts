import { symmetricEncrypt, symmetricDecrypt } from "better-auth/crypto";
import { z } from "zod";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { AppError } from "@/server/lib/errors";
import type { SeoProviderId } from "@/types/schemas/seo-provider";

async function encryptionKey(version: string) {
  if (!/^[A-Za-z0-9_]{1,32}$/.test(version))
    throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
  const key = await getOptionalEnvValue(`SEO_PROVIDER_SECRET_${version}`);
  if (!key || key.length < 32)
    throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
  return key;
}

export async function sealProviderCredentials(authorization: string) {
  const keyVersion =
    (await getOptionalEnvValue("SEO_PROVIDER_SECRET_VERSION")) ?? "v1";
  const encryptedCredentials = await symmetricEncrypt({
    key: await encryptionKey(keyVersion),
    data: authorization,
  });
  return { encryptedCredentials, keyVersion };
}

export async function openProviderCredentials(
  ciphertext: string,
  keyVersion: string,
) {
  try {
    return await symmetricDecrypt({
      key: await encryptionKey(keyVersion),
      data: ciphertext,
    });
  } catch {
    throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
  }
}

function validateBasicCredentials(value: string): string {
  try {
    const decoded = atob(value);
    const separator = decoded.indexOf(":");
    if (
      separator <= 0 ||
      separator === decoded.length - 1 ||
      btoa(decoded) !== value
    )
      throw new Error();
    return value;
  } catch {
    throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
  }
}

export function encodeBasicCredentials(login: string, password: string) {
  const bytes = new TextEncoder().encode(`${login}:${password}`);
  return btoa(String.fromCharCode(...bytes));
}

export async function environmentCredentials(provider: SeoProviderId) {
  if (provider === "treg") {
    const token = await getOptionalEnvValue("TREG_TOKEN");
    if (!token?.trim()) throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
    return token.trim();
  }
  const login = await getOptionalEnvValue("DATAFORSEO_API_LOGIN");
  const password = await getOptionalEnvValue("DATAFORSEO_API_PASSWORD");
  if (login !== undefined || password !== undefined) {
    if (!login || !password || login.includes(":"))
      throw new AppError("SEO_PROVIDER_NOT_CONFIGURED");
    return encodeBasicCredentials(login, password);
  }
  return validateBasicCredentials(
    (await getOptionalEnvValue("DATAFORSEO_API_KEY")) ?? "",
  );
}

// Persist only a digest of the tested credential, never the plaintext value.
// Credential bundles are API secrets with high entropy; this binds environment
// candidates too, so changing an environment key invalidates a previous test.
export async function credentialDigest(authorization: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(authorization),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export const storedCredentialSourceSchema = z.enum(["database", "environment"]);
