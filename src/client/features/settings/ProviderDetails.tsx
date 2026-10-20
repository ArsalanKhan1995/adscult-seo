import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { Button } from "@/client/components/ui/button";
import type { getProviderSettings } from "@/serverFunctions/seoProvider";

type ConfigurationSummary = Awaited<
  ReturnType<typeof getProviderSettings>
>["history"][number];

export function ProviderDetails({
  capabilities,
  isCandidate,
  history,
  disabled,
  onSelect,
}: {
  capabilities: Array<{ operation: string; label?: string; state: string }>;
  isCandidate: boolean;
  history: ConfigurationSummary[];
  disabled: boolean;
  onSelect: (configuration: ConfigurationSummary) => void;
}) {
  return (
    <>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          {isCandidate ? "Candidate" : "Active provider"} feature availability
        </summary>
        {capabilities.length === 0 ? (
          <p className="mt-3">
            Test the candidate to load its feature availability.
          </p>
        ) : (
          <div className="mt-3 max-h-64 overflow-auto">
            <table className="w-full text-left">
              <caption className="sr-only">Operation availability</caption>
              <thead>
                <tr>
                  <th className="py-2">Operation</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map(({ operation, label, state }) => (
                  <tr key={operation} className="border-t">
                    <td className="py-2 pr-3">{label ?? operation}</td>
                    <td className="py-2 capitalize">{state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Retained configurations and rollback
          </summary>
          <p className="my-3 text-muted-foreground">
            Select a retained configuration, test it, then activate it as a new
            revision.
          </p>
          <ul className="space-y-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {item.provider} · {item.credentialSource} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onSelect(item)}
                >
                  Select
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export function ProviderActiveStatus({
  settings,
}: {
  settings: Awaited<ReturnType<typeof getProviderSettings>>;
}) {
  return (
    <>
      {" "}
      <p className="text-sm">
        Active: <strong>{settings.provider ?? "Invalid configuration"}</strong>{" "}
        · Revision {settings.revision} · Selection from{" "}
        {settings.selectionSource}
      </p>
      <p className="text-sm text-muted-foreground">
        Credentials:{" "}
        {settings.configured
          ? `configured (${settings.credentialSource})`
          : "not configured"}
        . Changes apply to this organization.
      </p>
      {settings.operationalError && (
        <p role="alert" className="text-sm">
          {getStandardErrorMessage(new Error(settings.operationalError))}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {settings.lastTest
          ? `Last activation test: ${settings.lastTest.outcome}, ${new Date(settings.lastTest.testedAt).toLocaleString()}.`
          : "The active configuration has no recorded connection test."}
      </p>
    </>
  );
}
