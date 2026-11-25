package ar.gestorpenal.news;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The firm's news wall ("Novedades"). There is no delete: a post is archived. */
@RestController
@RequestMapping("/api/v1/news")
class NewsController {

    private final NewsService news;

    NewsController(NewsService news) {
        this.news = news;
    }

    /** Newest first; the first page also lists the deadlines due soon. */
    @GetMapping
    NewsFeed feed(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return news.feed(user, page, size);
    }

    @PostMapping("/posts")
    ResponseEntity<NewsItem.PostView> post(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody PostData body) {
        NewsItem.PostView created = news.post(user, body);
        return ResponseEntity.created(URI.create("/api/v1/news/posts/" + created.id())).body(created);
    }

    @PostMapping("/posts/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        news.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/posts/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        news.restore(user, id);
        return ResponseEntity.noContent().build();
    }
}
