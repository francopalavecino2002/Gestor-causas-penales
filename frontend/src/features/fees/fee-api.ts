import type {
  CalculationRequest,
  FeeCalculation,
  FeeScaleView,
  JusValueData,
  JusValueHistory,
  JusValueView,
} from "@/features/fees/fee-types";
import { apiFetch } from "@/lib/api";

const FEES = "/api/v1/fees";

export function fetchFeeScale(signal?: AbortSignal): Promise<FeeScaleView> {
  return apiFetch<FeeScaleView>(`${FEES}/scale`, { signal });
}

export function fetchJusValues(
  includeArchived: boolean,
  signal?: AbortSignal,
): Promise<JusValueHistory> {
  return apiFetch<JusValueHistory>(`${FEES}/jus-values?includeArchived=${includeArchived}`, {
    signal,
  });
}

export function createJusValue(data: JusValueData): Promise<JusValueView> {
  return apiFetch<JusValueView>(`${FEES}/jus-values`, { method: "POST", body: data });
}

/** Nothing is deleted: a wrong value is archived, and can be restored. */
export function setJusValueArchived(id: string, archived: boolean): Promise<void> {
  return apiFetch(`${FEES}/jus-values/${id}/${archived ? "archive" : "restore"}`, {
    method: "POST",
  });
}

/** Stateless: the server stores nothing about a calculation. */
export function calculateFee(request: CalculationRequest): Promise<FeeCalculation> {
  return apiFetch<FeeCalculation>(`${FEES}/calculations`, { method: "POST", body: request });
}
