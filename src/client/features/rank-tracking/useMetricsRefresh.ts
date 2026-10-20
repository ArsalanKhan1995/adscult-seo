import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshTrackingKeywordMetrics } from "@/serverFunctions/rank-tracking";

export function useMetricsRefresh(projectId: string, configId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      refreshTrackingKeywordMetrics({
        data: { projectId, configId },
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: ["rankTrackingResults", projectId, configId],
      });
      if (result.failures?.length) {
        toast.warning(
          `Metrics updated for ${result.updated} keywords; ${result.failures.length} could not be refreshed.`,
        );
      } else {
        toast.success(`Metrics updated for ${result.updated} keywords`);
      }
    },
  });
  return { refresh: mutation.mutate, isRefreshing: mutation.isPending };
}
