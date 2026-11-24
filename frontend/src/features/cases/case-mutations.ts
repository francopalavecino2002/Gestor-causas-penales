import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  addDefendant,
  addParty,
  createCase,
  updateCase,
  updateDefendant,
  type CaseData,
  type DefendantData,
  type PartyData,
} from "@/features/cases/case-write-api";
import type { CaseDetail } from "@/features/cases/case-types";
import { createPerson, type NewHumanPerson } from "@/features/persons/person-api";

/** After any change to a case: the list (summaries) and that case's own queries. */
export function invalidateCase(queryClient: QueryClient, caseId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["cases"] }),
    queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
  ]);
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CaseData) => createCase(data),
    onSuccess: (created) => {
      queryClient.setQueryData<CaseDetail>(["case", created.id], created);
      return queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useUpdateCase(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CaseData) => updateCase(caseId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<CaseDetail>(["case", caseId], updated);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["agenda"] }),
      ]);
    },
  });
}

export function useCreatePerson() {
  return useMutation({ mutationFn: (person: NewHumanPerson) => createPerson(person) });
}

export function useAddDefendant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { caseId: string; data: DefendantData }) =>
      addDefendant(variables.caseId, variables.data),
    onSuccess: (_defendant, variables) => invalidateCase(queryClient, variables.caseId),
  });
}

export function useUpdateDefendant(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { defendantId: string; data: DefendantData }) =>
      updateDefendant(caseId, variables.defendantId, variables.data),
    onSuccess: () =>
      Promise.all([
        invalidateCase(queryClient, caseId),
        queryClient.invalidateQueries({ queryKey: ["agenda"] }),
      ]),
  });
}

export function useAddParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { caseId: string; data: PartyData }) =>
      addParty(variables.caseId, variables.data),
    onSuccess: (_party, variables) => invalidateCase(queryClient, variables.caseId),
  });
}
