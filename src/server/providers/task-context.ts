import { z } from "zod";
import { getScopedProviderExecution } from "@/server/providers/context";
import { ProviderRepository } from "@/server/providers/repository";
import { resolveProviderExecution } from "@/server/providers/resolver";
import { environmentCredentials } from "@/server/providers/credentials";
import type { ProviderExecution } from "@/server/providers/types";
import { AppError } from "@/server/lib/errors";

export async function resolveTaskExecution(
  path: string,
  current: ProviderExecution | undefined,
) {
  const taskId = path.split("/task_get/")[1]?.split("/").at(-1);
  if (!taskId) return current;
  const task = current
    ? await ProviderRepository.task(current.organizationId, taskId)
    : await ProviderRepository.internalTask(taskId);
  if (!task) {
    // Tasks submitted before this migration always used installation env
    // DataForSEO credentials. An active override must not steal their polling.
    if (!current) return undefined;
    if (await ProviderRepository.internalTask(taskId))
      throw new AppError("FORBIDDEN");
    return Object.freeze({
      ...current,
      provider: "dataforseo" as const,
      revision: 0,
      credentialVersion: null,
      source: "environment" as const,
      authorization: await environmentCredentials("dataforseo"),
    });
  }
  if (task.operation.split("/task_post")[0] !== path.split("/task_get")[0])
    throw new AppError("VALIDATION_ERROR");
  if (!task.configurationId) {
    return Object.freeze({
      organizationId: task.organizationId,
      provider: "dataforseo" as const,
      revision: task.revision,
      credentialVersion: null,
      source: "environment" as const,
      authorization: await environmentCredentials("dataforseo"),
    });
  }
  return resolveProviderExecution(
    task.organizationId,
    task.configurationId,
    task.revision,
  );
}

const submittedTasksSchema = z.object({
  status_code: z.literal(20000),
  tasks: z
    .array(
      z.object({
        id: z.string().nullable().optional(),
        status_code: z.number(),
      }),
    )
    .nullable()
    .optional(),
});

export async function recordSubmittedTasks(path: string, response: unknown) {
  if (!path.endsWith("/task_post")) return;
  const execution = await getScopedProviderExecution();
  if (!execution) return;
  const parsed = submittedTasksSchema.safeParse(response);
  if (!parsed.success) return; // Existing envelope validation reports failure.
  const rows = (parsed.data.tasks ?? []).flatMap((task) =>
    task.id && [20000, 20100].includes(task.status_code)
      ? [
          {
            upstreamTaskId: task.id,
            organizationId: execution.organizationId,
            provider: execution.provider,
            configurationId: execution.credentialVersion,
            revision: execution.revision,
            operation: path,
            createdAt: new Date().toISOString(),
          },
        ]
      : [],
  );
  await ProviderRepository.saveTasks(rows);
}
