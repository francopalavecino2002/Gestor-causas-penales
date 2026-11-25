package ar.gestorpenal.news;

import ar.gestorpenal.deadline.DeadlineAlert;
import java.util.List;

/**
 * One page of the wall, newest first.
 *
 * @param dueSoon the visible deadlines inside their alert window, soonest and detainee ones first; only on
 *     the first page, since they are a state and not a change
 */
record NewsFeed(List<DeadlineAlert> dueSoon, List<NewsItem> items, int page, int size, long total) {}
