package ar.gestorpenal.calendarfeed;

import ar.gestorpenal.calendarfeed.CalendarFeedService.FeedStatus;
import ar.gestorpenal.calendarfeed.CalendarFeedService.IssuedFeed;
import ar.gestorpenal.hearing.HearingIcsExport;
import ar.gestorpenal.security.AuthenticatedUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The calendar feed (ADR-0034). The member manages their own link under {@code /me}; the feed itself
 * is public, because calendar apps cannot log in, and the secret in its path is the only credential.
 */
@RestController
class CalendarFeedController {

    static final String MY_FEED = "/api/v1/me/calendar-feed";

    private final CalendarFeedService feeds;

    CalendarFeedController(CalendarFeedService feeds) {
        this.feeds = feeds;
    }

    @GetMapping(MY_FEED)
    FeedStatus status(@AuthenticationPrincipal AuthenticatedUser user) {
        return feeds.status(user);
    }

    /** Creates the link, or replaces it: the old one stops working. The secret is shown only here. */
    @PostMapping(MY_FEED)
    ResponseEntity<IssuedFeed> issue(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(feeds.issue(user));
    }

    @PostMapping(MY_FEED + "/revoke")
    ResponseEntity<Void> revoke(@AuthenticationPrincipal AuthenticatedUser user) {
        feeds.revoke(user);
        return ResponseEntity.noContent().build();
    }

    /** What a calendar app subscribes to. An unknown or revoked secret answers 404, with no body. */
    @GetMapping(CalendarFeedService.FEED_PATH_PREFIX + "{secret}" + CalendarFeedService.FEED_PATH_SUFFIX)
    ResponseEntity<String> feed(@PathVariable String secret) {
        return feeds.calendarOf(secret)
                .map(calendar -> ResponseEntity.ok()
                        .contentType(HearingIcsExport.MEDIA_TYPE)
                        .cacheControl(CacheControl.noStore())
                        .header("X-Robots-Tag", "noindex")
                        .header("Referrer-Policy", "no-referrer")
                        .body(calendar))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
