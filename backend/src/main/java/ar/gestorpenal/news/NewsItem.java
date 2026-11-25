package ar.gestorpenal.news;

import java.time.Instant;
import java.util.UUID;

/**
 * One entry of the wall. Only what the user already sees on the case and the agenda: the caption,
 * the hearing type, date and status, never notes or result summaries.
 *
 * @param actor who did it; {@code null} for work done without a logged-in user (seed data, imports by jobs)
 * @param caseLink the case of a case or hearing entry; {@code null} for a post
 * @param hearing the hearing of a hearing entry
 * @param post the text of a post entry
 */
record NewsItem(
        long id, NewsKind kind, Instant occurredAt, MemberRef actor, CaseLink caseLink, HearingLink hearing, PostView post) {

    record MemberRef(UUID id, String displayName) {}

    record CaseLink(UUID id, String caption, String practiceArea) {}

    /**
     * @param startsAt the hearing's date now
     * @param previousStartsAt the date before a reschedule
     * @param newStartsAt the date a reschedule set (it can differ from {@code startsAt} after another reschedule)
     * @param statusCode the status a result entry set
     */
    record HearingLink(
            UUID id,
            String typeCode,
            String typeName,
            Instant startsAt,
            Instant previousStartsAt,
            Instant newStartsAt,
            String statusCode,
            String statusName) {}

    /** @param canArchive whether the user may archive it: its author or the owner */
    record PostView(UUID id, String body, boolean canArchive) {}
}
