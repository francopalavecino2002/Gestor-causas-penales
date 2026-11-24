import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  changeAiAssist,
  fetchAiAssist,
  requestHearingDraft,
} from "@/features/ai-assist/ai-assist-api";

const AI_ASSIST_KEY = ["ai-assist"] as const;

export function useAiAssist() {
  return useQuery({
    queryKey: AI_ASSIST_KEY,
    queryFn: ({ signal }) => fetchAiAssist(signal),
    staleTime: 5 * 60 * 1000,
  });
}

/** True only when the installation has a provider and the firm turned it on. */
export function useAiAssistReady(): boolean {
  const { data } = useAiAssist();
  return data?.available === true && data.enabled;
}

export function useChangeAiAssist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changeAiAssist,
    onSuccess: (status) => queryClient.setQueryData(AI_ASSIST_KEY, status),
  });
}

export function useHearingDraft() {
  return useMutation({
    mutationFn: ({ caseId, text }: { caseId: string; text: string }) =>
      requestHearingDraft(caseId, text),
  });
}
