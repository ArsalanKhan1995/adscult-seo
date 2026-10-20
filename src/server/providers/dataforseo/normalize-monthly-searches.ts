import type { MonthlySearch } from "@/types/keywords";

export function normalizeMonthlySearches(
  entries:
    | Array<{
        year?: number | null;
        month?: number | null;
        search_volume?: number | null;
      }>
    | null
    | undefined,
): MonthlySearch[] {
  return (entries ?? []).flatMap(({ year, month, search_volume }) => {
    // A missing date cannot identify a point on the timeline. A missing
    // measurement at a known date is a gap, while a measured zero stays zero.
    if (
      year == null ||
      month == null ||
      !Number.isInteger(year) ||
      year <= 0 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    )
      return [];
    return [{ year, month, searchVolume: search_volume ?? null }];
  });
}
