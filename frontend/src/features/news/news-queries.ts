import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createPost, fetchNews, setPostArchived } from "@/features/news/news-api";
import type { NewsFeed } from "@/features/news/news-types";

const NEWS_KEY = "news";

/** Entries per "Mirá más novedades": a few days of a small firm, light on a phone. */
export const NEWS_PAGE_SIZE = 20;

/** The wall, growing with "Mirá más novedades". Deadlines due soon come with the first page. */
export function useNewsFeed() {
  return useInfiniteQuery({
    queryKey: [NEWS_KEY, "feed"] as const,
    queryFn: ({ pageParam, signal }) => fetchNews(pageParam, NEWS_PAGE_SIZE, signal),
    initialPageParam: 0,
    getNextPageParam: (last: NewsFeed) =>
      (last.page + 1) * last.size < last.total ? last.page + 1 : undefined,
  });
}

/** The latest entries only, e.g. the agenda home's card. */
export function useNewsPreview(size: number) {
  return useQuery({
    queryKey: [NEWS_KEY, "preview", size] as const,
    queryFn: ({ signal }) => fetchNews(0, size, signal),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createPost(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [NEWS_KEY] }),
  });
}

/**
 * Archives a post or restores it. The open wall is not refetched: the screen keeps the archived
 * post in place as "Archivaste esta publicación" with "Deshacé". The wall is only marked stale, so
 * the next visit reads it again without the post; the home card's preview refetches at once.
 */
export function useSetPostArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { postId: string; archived: boolean }) =>
      setPostArchived(variables.postId, variables.archived),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [NEWS_KEY, "preview"] }),
        queryClient.invalidateQueries({ queryKey: [NEWS_KEY, "feed"], refetchType: "none" }),
      ]),
  });
}
