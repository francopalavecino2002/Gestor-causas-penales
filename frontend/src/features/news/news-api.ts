import type { NewsFeed, PostView } from "@/features/news/news-types";
import { apiFetch } from "@/lib/api";

const NEWS = "/api/v1/news";

export function fetchNews(page: number, size: number, signal?: AbortSignal): Promise<NewsFeed> {
  return apiFetch<NewsFeed>(`${NEWS}?page=${page}&size=${size}`, { signal });
}

export function createPost(body: string): Promise<PostView> {
  return apiFetch<PostView>(`${NEWS}/posts`, { method: "POST", body: { body } });
}

/** Nothing is deleted: a post is archived, and can be restored. */
export function setPostArchived(postId: string, archived: boolean): Promise<void> {
  return apiFetch(`${NEWS}/posts/${postId}/${archived ? "archive" : "restore"}`, {
    method: "POST",
  });
}
