package ar.gestorpenal.news;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.hearing.HearingRef;
import ar.gestorpenal.hearing.Hearings;
import ar.gestorpenal.news.NewsEvents.Event;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Builds {@link NewsItem}s, loading the members, posts, cases and hearings of a whole page at once. */
@Component
class NewsViews {

    private final UserRepository users;
    private final FirmPostRepository posts;
    private final Cases cases;
    private final Hearings hearings;

    NewsViews(UserRepository users, FirmPostRepository posts, Cases cases, Hearings hearings) {
        this.users = users;
        this.posts = posts;
        this.cases = cases;
        this.hearings = hearings;
    }

    /** Whether the user may archive or restore the post: its author or the owner. */
    static boolean canArchive(AuthenticatedUser user, FirmPost post) {
        return user.role() == Role.OWNER || user.userId().equals(post.getAuthorUserId());
    }

    /**
     * The items of the events, in the same order. The query already left out what the user cannot see;
     * an event whose record vanished or became invisible in between is dropped rather than shown bare.
     */
    List<NewsItem> of(AuthenticatedUser user, List<Event> events) {
        if (events.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> actorNames = users.findAllById(ids(events, event -> true, Event::actorUserId)).stream()
                .collect(Collectors.toMap(AppUser::getId, AppUser::getDisplayName));
        Map<UUID, FirmPost> postsById = posts.findAllById(ids(events, NewsViews::isPost, Event::entityId)).stream()
                .collect(Collectors.toMap(FirmPost::getId, Function.identity()));
        Map<UUID, HearingRef> hearingRefs = hearings.findAll(ids(events, NewsViews::isHearing, Event::entityId));
        List<UUID> caseIds = new ArrayList<>(ids(events, event -> event.kind() == NewsKind.CASE_OPENED, Event::entityId));
        hearingRefs.values().stream().map(HearingRef::caseId).distinct().forEach(caseIds::add);
        Map<UUID, CaseRef> caseRefs = cases.findAll(user, caseIds);
        Names names = new Names(hearings);
        return events.stream()
                .map(event -> item(user, event, actorNames, postsById, hearingRefs, caseRefs, names))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<NewsItem> item(
            AuthenticatedUser user,
            Event event,
            Map<UUID, String> actorNames,
            Map<UUID, FirmPost> postsById,
            Map<UUID, HearingRef> hearingRefs,
            Map<UUID, CaseRef> caseRefs,
            Names names) {
        NewsItem.MemberRef actor = event.actorUserId() == null
                ? null
                : new NewsItem.MemberRef(event.actorUserId(), actorNames.get(event.actorUserId()));
        if (isPost(event)) {
            return Optional.ofNullable(postsById.get(event.entityId()))
                    .map(post -> new NewsItem(event.id(), event.kind(), event.occurredAt(), actor, null, null,
                            new NewsItem.PostView(post.getId(), post.getBody(), canArchive(user, post))));
        }
        HearingRef hearing = isHearing(event) ? hearingRefs.get(event.entityId()) : null;
        if (isHearing(event) && hearing == null) {
            return Optional.empty();
        }
        CaseRef caseRef = caseRefs.get(hearing == null ? event.entityId() : hearing.caseId());
        if (caseRef == null || !caseRef.visible()) {
            return Optional.empty();
        }
        NewsItem.CaseLink caseLink = new NewsItem.CaseLink(caseRef.id(), caseRef.caption(), caseRef.practiceArea());
        NewsItem.HearingLink hearingLink = hearing == null ? null : hearingLink(event, hearing, caseRef.practiceArea(), names);
        return Optional.of(new NewsItem(event.id(), event.kind(), event.occurredAt(), actor, caseLink, hearingLink, null));
    }

    private static NewsItem.HearingLink hearingLink(Event event, HearingRef hearing, String area, Names names) {
        boolean rescheduled = event.kind() == NewsKind.HEARING_RESCHEDULED;
        String status = event.kind() == NewsKind.HEARING_RESULT ? event.newValue() : null;
        return new NewsItem.HearingLink(
                hearing.id(),
                hearing.typeCode(),
                names.type(area, hearing.typeCode()),
                hearing.startsAt(),
                rescheduled ? instant(event.oldValue()) : null,
                rescheduled ? instant(event.newValue()) : null,
                status,
                status == null ? null : names.status(area, status));
    }

    private static boolean isPost(Event event) {
        return event.kind() == NewsKind.POST;
    }

    private static boolean isHearing(Event event) {
        return switch (event.kind()) {
            case HEARING_SCHEDULED, HEARING_RESCHEDULED, HEARING_RESULT -> true;
            case CASE_OPENED, POST -> false;
        };
    }

    private static List<UUID> ids(List<Event> events, Predicate<Event> filter, Function<Event, UUID> id) {
        return events.stream().filter(filter).map(id).filter(Objects::nonNull).distinct().toList();
    }

    /** The audit log stores an instant as its ISO-8601 text. */
    private static Instant instant(String text) {
        return text == null ? null : Instant.parse(text);
    }

    /** Catalog names per practice area, loaded once per page. */
    private static final class Names {

        private final Hearings hearings;
        private final Map<String, Map<String, String>> types = new HashMap<>();
        private final Map<String, Map<String, String>> statuses = new HashMap<>();

        Names(Hearings hearings) {
            this.hearings = hearings;
        }

        String type(String area, String code) {
            return types.computeIfAbsent(area, hearings::typeNames).getOrDefault(code, code);
        }

        String status(String area, String code) {
            return statuses.computeIfAbsent(area, hearings::statusNames).getOrDefault(code, code);
        }
    }
}
