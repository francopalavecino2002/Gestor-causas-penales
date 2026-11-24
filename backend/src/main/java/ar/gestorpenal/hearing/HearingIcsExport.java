package ar.gestorpenal.hearing;

import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.security.AuthenticatedUser;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The hearings as iCalendar (ADR-0034), for calendar apps outside the product. What leaves is the
 * least a lawyer needs to plan the day: type, time, room, status and, for cases that are not
 * reserved, the caption, judge and OFIJU reference. Defendants, notes and results never leave. A
 * reserved case is shown without caption even to those who may see it, because the event ends up
 * stored by a third-party calendar.
 */
@Service
public class HearingIcsExport {

    public static final MediaType MEDIA_TYPE = new MediaType("text", "calendar", StandardCharsets.UTF_8);

    /** Past hearings kept in the feed, so last weeks' entries do not vanish from the calendar. */
    static final int PAST_DAYS = 90;

    static final String CALENDAR_NAME = "Audiencias";
    static final String RESERVED_CAPTION = "Causa reservada";

    private final HearingRepository hearings;
    private final HearingViews views;
    private final HearingService hearingService;
    private final HearingCalendar calendar;
    private final Cases cases;

    HearingIcsExport(
            HearingRepository hearings,
            HearingViews views,
            HearingService hearingService,
            HearingCalendar calendar,
            Cases cases) {
        this.hearings = hearings;
        this.views = views;
        this.hearingService = hearingService;
        this.calendar = calendar;
        this.cases = cases;
    }

    /** Every hearing {@code user} attends from {@value #PAST_DAYS} days ago on, soonest first. */
    @Transactional(readOnly = true)
    public String feedOf(AuthenticatedUser user) {
        List<Hearing> found = hearings.findAttendedSince(
                calendar.startOfDay(calendar.today().minusDays(PAST_DAYS)), cases.seesEveryCase(user), user.userId());
        return write(user, views.heads(user, found));
    }

    /** One hearing the user may see, to add it to a calendar by hand. */
    @Transactional(readOnly = true)
    String hearing(AuthenticatedUser user, UUID hearingId) {
        return write(user, List.of(hearingService.view(user, hearingId)));
    }

    private String write(AuthenticatedUser user, List<HearingView> heads) {
        Map<UUID, CaseRef> caseRefs = cases.findAll(user, heads.stream().map(HearingView::caseId).distinct().toList());
        List<IcsWriter.Event> events = heads.stream()
                .map(head -> event(head, isReserved(caseRefs.get(head.caseId()))))
                .toList();
        return IcsWriter.calendar(CALENDAR_NAME, HearingCalendar.ZONE.getId(), calendar.now(), events);
    }

    /** A case that cannot be found is treated as reserved: when in doubt, show less. */
    private static boolean isReserved(CaseRef caseRef) {
        return caseRef == null || caseRef.reserved();
    }

    static IcsWriter.Event event(HearingView head, boolean reserved) {
        String caption = reserved ? RESERVED_CAPTION : head.caseCaption();
        return new IcsWriter.Event(
                head.id(),
                head.startsAt(),
                head.startsAt().plusSeconds(60L * head.durationMinutes()),
                head.typeName() + " · " + caption,
                head.room(),
                description(head, reserved),
                status(head));
    }

    private static String description(HearingView head, boolean reserved) {
        List<String> lines = new ArrayList<>();
        lines.add(head.typeArticle() == null ? head.typeName() : head.typeName() + " (" + head.typeArticle() + ")");
        lines.add("Estado: " + head.statusName());
        if (!reserved && head.judge() != null) {
            lines.add("Juez/a: " + head.judge());
        }
        if (!reserved && head.ofijuReference() != null) {
            lines.add("Referencia OFIJU: " + head.ofijuReference());
        }
        lines.add("Exportado del gestor de causas: verificá los datos en la agenda.");
        return String.join("\n", lines);
    }

    private static IcsWriter.Status status(HearingView head) {
        if (head.archived() || HearingRules.NOT_HELD.contains(head.statusCode())) {
            return IcsWriter.Status.CANCELLED;
        }
        return HearingRules.REQUESTED.equals(head.statusCode()) ? IcsWriter.Status.TENTATIVE : IcsWriter.Status.CONFIRMED;
    }
}
