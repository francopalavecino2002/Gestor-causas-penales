package ar.gestorpenal.news;

import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.deadline.DeadlineAlert;
import ar.gestorpenal.deadline.Deadlines;
import ar.gestorpenal.hearing.Hearings;
import ar.gestorpenal.security.AuthenticatedUser;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The firm's news wall (ADR-0038): what changed, read from the audit log, plus short manual posts.
 * Every member reads the wall and posts; entries about a reserved case only reach its team and the
 * owner. A post is archived, never deleted, by its author or the owner.
 */
@Service
class NewsService {

    static final int MAX_PAGE_SIZE = 50;

    private final NewsEvents events;
    private final NewsViews views;
    private final FirmPostRepository posts;
    private final Cases cases;
    private final Hearings hearings;
    private final Deadlines deadlines;
    private final Clock clock;

    NewsService(
            NewsEvents events,
            NewsViews views,
            FirmPostRepository posts,
            Cases cases,
            Hearings hearings,
            Deadlines deadlines,
            Clock clock) {
        this.events = events;
        this.views = views;
        this.posts = posts;
        this.cases = cases;
        this.hearings = hearings;
        this.deadlines = deadlines;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    NewsFeed feed(AuthenticatedUser user, int page, int size) {
        int pageNumber = Math.max(page, 0);
        int pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        NewsEvents.Scope scope = new NewsEvents.Scope(
                user.tenantId(), user.userId(), cases.seesEveryCase(user), hearings.resultStatuses());
        List<NewsItem> items = views.of(user, events.page(scope, pageNumber, pageSize));
        List<DeadlineAlert> dueSoon = pageNumber == 0 ? deadlines.dueSoon(user) : List.of();
        return new NewsFeed(dueSoon, items, pageNumber, pageSize, events.count(scope));
    }

    @Transactional
    NewsItem.PostView post(AuthenticatedUser user, PostData data) {
        FirmPost post = posts.saveAndFlush(FirmPost.create(user.userId(), data.body(), clock.instant()));
        return new NewsItem.PostView(post.getId(), post.getBody(), true);
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        manageable(user, id).archive(clock.instant());
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        manageable(user, id).restore();
    }

    private FirmPost manageable(AuthenticatedUser user, UUID id) {
        FirmPost post = posts.findById(id).orElseThrow(() -> new PostNotFoundException("There is no post " + id));
        if (!NewsViews.canArchive(user, post)) {
            throw new AccessDeniedException("Only the author or the owner can archive or restore a post");
        }
        return post;
    }
}
