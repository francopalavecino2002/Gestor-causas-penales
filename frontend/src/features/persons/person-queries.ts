import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import {
  addContact,
  archiveContact,
  checkConflict,
  createPerson,
  fetchClient,
  fetchPersonList,
  fetchPersonOverview,
  makeClient,
  setClientArchived,
  setPersonArchived,
  updateClient,
  updateContact,
  updatePerson,
  type ClientData,
  type ContactData,
  type PersonData,
  type PersonListParams,
} from "@/features/persons/person-api";

// The defendant picker caches its searches under "persons" too, so one invalidation covers both.
const PERSONS_KEY = "persons";
const CLIENTS_KEY = "clients";

export function usePersonList(params: PersonListParams) {
  return useQuery({
    queryKey: [PERSONS_KEY, "list", params] as const,
    queryFn: ({ signal }) => fetchPersonList(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePersonOverview(id: string) {
  return useQuery({
    queryKey: [PERSONS_KEY, "overview", id] as const,
    queryFn: ({ signal }) => fetchPersonOverview(id, signal),
  });
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: [CLIENTS_KEY, id] as const,
    queryFn: ({ signal }) => fetchClient(id ?? "", signal),
    enabled: id !== null,
  });
}

/** Persons, clients and the cases that show a person's name: all may have changed. */
function invalidatePeople(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [PERSONS_KEY] }),
    queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
    queryClient.invalidateQueries({ queryKey: ["cases"] }),
  ]);
}

/** Creates a person, or replaces one with `personId`. */
export function useSavePerson(personId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PersonData) =>
      personId ? updatePerson(personId, data) : createPerson(data),
    onSuccess: () => invalidatePeople(queryClient),
  });
}

export function useSetPersonArchived(personId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => setPersonArchived(personId, archived),
    onSettled: () => invalidatePeople(queryClient),
  });
}

/** Changes nothing on the server: a mutation only because it is a POST run on demand. */
export function useConflictCheck() {
  return useMutation({ mutationFn: (documentNumber: string) => checkConflict(documentNumber) });
}

/** Makes the person a client, or with `clientId` updates the client's data. */
export function useSaveClient(personId: string, clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClientData) =>
      clientId ? updateClient(clientId, data) : makeClient(personId, data),
    onSuccess: () => invalidatePeople(queryClient),
  });
}

export function useSetClientArchived(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => setClientArchived(clientId, archived),
    onSettled: () => invalidatePeople(queryClient),
  });
}

/** Adds an authorized contact, or with `contactId` updates it. */
export function useSaveContact(clientId: string, contactId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ContactData) =>
      contactId ? updateContact(clientId, contactId, data) : addContact(clientId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, clientId] }),
  });
}

export function useArchiveContact(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => archiveContact(clientId, contactId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, clientId] }),
  });
}
