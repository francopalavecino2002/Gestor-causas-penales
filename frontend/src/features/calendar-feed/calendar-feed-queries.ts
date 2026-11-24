import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCalendarFeed,
  fetchCalendarFeed,
  fetchHearingIcs,
  revokeCalendarFeed,
  type CalendarFeedStatus,
} from "@/features/calendar-feed/calendar-feed-api";
import { saveBlob } from "@/lib/download";

const CALENDAR_FEED_KEY = ["calendar-feed"] as const;

export function useCalendarFeed() {
  return useQuery({
    queryKey: CALENDAR_FEED_KEY,
    queryFn: ({ signal }) => fetchCalendarFeed(signal),
  });
}

export function useCreateCalendarFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCalendarFeed,
    // The answer carries the one-time secret: drop it from the mutation cache right away.
    gcTime: 0,
    onSuccess: ({ createdAt }) =>
      queryClient.setQueryData<CalendarFeedStatus>(CALENDAR_FEED_KEY, { active: true, createdAt }),
  });
}

export function useRevokeCalendarFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeCalendarFeed,
    onSuccess: () =>
      queryClient.setQueryData<CalendarFeedStatus>(CALENDAR_FEED_KEY, {
        active: false,
        createdAt: null,
      }),
  });
}

/** The file every calendar app opens to add one event. */
const HEARING_ICS_NAME = "audiencia.ics";

/** Downloads one hearing as `audiencia.ics`. */
export function useHearingIcsDownload() {
  return useMutation({
    mutationFn: async (hearingId: string) => {
      saveBlob(await fetchHearingIcs(hearingId), HEARING_ICS_NAME);
    },
  });
}
