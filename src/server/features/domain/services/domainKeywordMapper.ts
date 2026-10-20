import type { DomainKeyword } from "@/server/providers/contracts/domain";

// Preserve the existing UI and cached-row shape while the provider contract
// carries the additional ranking semantics.
export function mapKeywordItem(item: DomainKeyword) {
  const {
    absolutePosition: _absolute,
    organicPosition: _organic,
    resultType: _type,
    intent: _intent,
    ...row
  } = item;
  return row;
}
