import { ProviderDetails, ProviderActiveStatus } from "./ProviderDetails";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { organizationContextQueryOptions } from "@/client/features/team/organizationQueries";
import { hasOrgPermission } from "@/lib/org-permissions";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getProviderSettings,
  saveProviderCandidate,
  testProviderCandidate,
  activateProviderCandidate,
} from "@/serverFunctions/seoProvider";
import type { SeoProviderId } from "@/types/schemas/seo-provider";

export function SeoProviderSettings() {
  const organization = useQuery(organizationContextQueryOptions());
  if (
    !organization.data ||
    !hasOrgPermission(organization.data.role, { integration: ["manage"] })
  )
    return null;
  return (
    <ProviderEditor
      key={organization.data.organizationId}
      organizationId={organization.data.organizationId}
    />
  );
}

function ProviderEditor({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["seo-provider-settings", organizationId],
    queryFn: () => getProviderSettings(),
    staleTime: 0,
  });
  const [provider, setProvider] = useState<SeoProviderId>("dataforseo");
  const [credentialAction, setCredentialAction] = useState<
    "unchanged" | "replace" | "environment"
  >("unchanged");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [candidateCapabilities, setCandidateCapabilities] = useState<
    Array<{ operation: string; label?: string; state: string }>
  >([]);
  const [test, setTest] = useState<Awaited<
    ReturnType<typeof testProviderCandidate>
  > | null>(null);
  const [candidateRevision, setCandidateRevision] = useState<number | null>(
    null,
  );

  const action = useMutation({
    mutationFn: async (kind: "save" | "test" | "activate" | "environment") => {
      if (kind === "save" || kind === "environment") {
        const credentials =
          kind === "environment" || credentialAction === "environment"
            ? { action: "environment" as const }
            : credentialAction === "unchanged"
              ? { action: "unchanged" as const }
              : {
                  action: "replace" as const,
                  bundle:
                    provider === "dataforseo"
                      ? { provider: "dataforseo" as const, login, password }
                      : { provider: "treg" as const, token },
                };
        const result = await saveProviderCandidate({
          data: {
            provider,
            selection: kind === "environment" ? "environment" : "explicit",
            credentials,
          },
        });
        setCandidateId(result.candidateId);
        setProvider(result.provider);
        setCandidateCapabilities(result.capabilities);
        setCandidateRevision(settings.data?.revision ?? 0);
        setTest(null);
        setLogin("");
        setPassword("");
        setToken("");
        setCredentialAction("unchanged");
        setNotice(
          `Candidate saved using ${result.credentialSource} credentials. ${result.chargeNotice}`,
        );
      } else if (candidateId && kind === "test") {
        const result = await testProviderCandidate({ data: { candidateId } });
        setTest(result);
        setCandidateCapabilities(result.capabilities);
        setNotice(
          result.ready
            ? "Authentication passed. The candidate is ready to activate."
            : result.authentication === "passed"
              ? "Authentication passed. SEO operations remain unverified; activation is unavailable."
              : `Candidate is not ready: ${result.outcome.replaceAll("_", " ")}.`,
        );
      } else if (candidateId && candidateRevision !== null) {
        await activateProviderCandidate({
          data: { candidateId, expectedRevision: candidateRevision },
        });
        setCandidateId(null);
        setTest(null);
        setNotice("Provider activated. New work uses this configuration.");
        await queryClient.invalidateQueries({
          queryKey: ["seo-provider-settings"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["seoApiKeyStatus"],
        });
      }
    },
  });

  function invalidateCandidate() {
    setCandidateId(null);
    setTest(null);
    setNotice("");
    setCandidateCapabilities([]);
    action.reset();
  }

  const capabilities = candidateId
    ? candidateCapabilities
    : (settings.data?.capabilities ?? []);

  return (
    <section className="space-y-4" aria-labelledby="seo-provider-heading">
      <SectionHeader title="SEO provider" />
      <h3 id="seo-provider-heading" className="sr-only">
        SEO provider settings
      </h3>
      {settings.isPending ? (
        <p role="status" className="text-sm">
          Loading provider settings…
        </p>
      ) : settings.error ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{getStandardErrorMessage(settings.error)}</p>
          <Button variant="outline" onClick={() => void settings.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <ProviderActiveStatus settings={settings.data} />
          <fieldset disabled={action.isPending} className="space-y-4">
            <legend className="mb-3 text-sm font-medium">
              Candidate configuration
            </legend>
            <div className="space-y-2">
              <Label htmlFor="seo-provider-choice">Provider</Label>
              <select
                id="seo-provider-choice"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={provider}
                onChange={(event) => {
                  setProvider(
                    event.target.value === "treg" ? "treg" : "dataforseo",
                  );
                  setLogin("");
                  setPassword("");
                  setToken("");
                  invalidateCandidate();
                }}
              >
                <option value="dataforseo">DataForSEO</option>
                <option value="treg">Treg (unverified)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-provider-credential-action">
                Credentials
              </Label>
              <select
                id="seo-provider-credential-action"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={credentialAction}
                onChange={(event) => {
                  const value = event.target.value;
                  setCredentialAction(
                    value === "replace"
                      ? "replace"
                      : value === "environment"
                        ? "environment"
                        : "unchanged",
                  );
                  invalidateCandidate();
                }}
              >
                <option value="unchanged">Keep saved credentials</option>
                <option value="replace">Replace credentials</option>
                <option value="environment">
                  Use server environment credentials
                </option>
              </select>
            </div>
            {credentialAction === "replace" &&
              (provider === "dataforseo" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="seo-provider-login">API login</Label>
                    <Input
                      id="seo-provider-login"
                      value={login}
                      autoComplete="off"
                      onChange={(e) => {
                        setLogin(e.target.value);
                        invalidateCandidate();
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo-provider-password">API password</Label>
                    <Input
                      id="seo-provider-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        invalidateCandidate();
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="seo-provider-token">Treg REST token</Label>
                  <Input
                    id="seo-provider-token"
                    type="password"
                    autoComplete="new-password"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      invalidateCandidate();
                    }}
                  />
                </div>
              ))}
            {provider === "treg" && (
              <p className="text-sm">
                Treg SEO operations have not passed integration verification.
                Activation is unavailable. No vendor request is made when
                testing this candidate.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => action.mutate("save")}>
                Save candidate
              </Button>
              <Button
                variant="outline"
                disabled={!candidateId}
                onClick={() => action.mutate("test")}
              >
                Test (free)
              </Button>
              <Button
                disabled={!candidateId || !test?.ready}
                onClick={() => action.mutate("activate")}
              >
                Activate
              </Button>
              <Button
                variant="ghost"
                onClick={() => action.mutate("environment")}
              >
                Preview server environment
              </Button>
            </div>
          </fieldset>
          {action.isPending && (
            <p role="status" className="text-sm">
              {action.variables === "test"
                ? "Testing authentication…"
                : "Saving provider settings…"}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          {test && (
            <p className="text-sm text-muted-foreground">
              Last tested: {new Date(test.testedAt).toLocaleString()}. Test
              expires after 15 minutes.
            </p>
          )}
          {action.error && (
            <p role="alert" className="text-sm text-destructive">
              {getStandardErrorMessage(action.error)}{" "}
              {action.error.message === "CONFLICT"
                ? "Refresh settings, test the candidate again, and retry."
                : ""}
            </p>
          )}
          {action.error?.message === "CONFLICT" && (
            <Button
              variant="outline"
              onClick={() => {
                invalidateCandidate();
                void settings.refetch();
              }}
            >
              Refresh settings
            </Button>
          )}
          <ProviderDetails
            capabilities={capabilities}
            isCandidate={Boolean(candidateId)}
            history={settings.data.history}
            disabled={action.isPending}
            onSelect={(item) => {
              invalidateCandidate();
              setLogin("");
              setPassword("");
              setToken("");
              setCredentialAction("unchanged");
              setCandidateId(item.id);
              setCandidateRevision(settings.data.revision);
              setProvider(item.provider === "treg" ? "treg" : "dataforseo");
              setNotice("Retained candidate selected. Test before activation.");
            }}
          />
        </>
      )}
    </section>
  );
}
