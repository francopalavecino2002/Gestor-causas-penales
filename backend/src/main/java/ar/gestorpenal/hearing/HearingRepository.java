package ar.gestorpenal.hearing;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Tenant-scoped by Hibernate: every query only sees the current firm's rows (ADR-0007). The queries
 * below also read {@code CaseFile} and {@code CaseTeamMember} by entity name, to filter reserved cases
 * and archived cases inside the query instead of after it (ADR-0016).
 */
interface HearingRepository extends JpaRepository<Hearing, UUID> {

    List<Hearing> findByCaseIdOrderByStartsAtDescIdAsc(UUID caseId);

    List<Hearing> findByCaseIdAndArchivedAtIsNullOrderByStartsAtDescIdAsc(UUID caseId);

    /**
     * Hearings that start in {@code [from, to)} in cases that are not archived and that the user may
     * see: a reserved case only for the owner ({@code seesEveryCase}) or its active team. When
     * {@code filterByLawyer} is set, only hearings that lawyer attends.
     */
    @Query("""
            select h from Hearing h, CaseFile c
            where c.id = h.caseId
              and h.archivedAt is null and c.archivedAt is null
              and h.startsAt >= :rangeStart and h.startsAt < :rangeEnd
              and (:seesEveryCase = true or c.reserved = false
                   or exists (select 1 from CaseTeamMember m
                              where m.caseId = c.id and m.userId = :userId and m.archivedAt is null))
              and (:filterByLawyer = false
                   or exists (select 1 from HearingLawyer l
                              where l.hearingId = h.id and l.userId = :lawyerId and l.archivedAt is null))
            order by h.startsAt, h.id
            """)
    List<Hearing> findAgenda(
            @Param("rangeStart") Instant rangeStart,
            @Param("rangeEnd") Instant rangeEnd,
            @Param("seesEveryCase") boolean seesEveryCase,
            @Param("userId") UUID userId,
            @Param("filterByLawyer") boolean filterByLawyer,
            @Param("lawyerId") UUID lawyerId);

    /**
     * Hearings that start at or after {@code since}, that {@code userId} attends, in cases that are not
     * archived and that the user may see (same rule as {@link #findAgenda}): their calendar feed.
     */
    @Query("""
            select h from Hearing h, CaseFile c
            where c.id = h.caseId
              and h.archivedAt is null and c.archivedAt is null
              and h.startsAt >= :since
              and (:seesEveryCase = true or c.reserved = false
                   or exists (select 1 from CaseTeamMember m
                              where m.caseId = c.id and m.userId = :userId and m.archivedAt is null))
              and exists (select 1 from HearingLawyer l
                          where l.hearingId = h.id and l.userId = :userId and l.archivedAt is null)
            order by h.startsAt, h.id
            """)
    List<Hearing> findAttendedSince(
            @Param("since") Instant since,
            @Param("seesEveryCase") boolean seesEveryCase,
            @Param("userId") UUID userId);

    /**
     * Hearings of cases that are not archived, attended by one of {@code userIds}, that start in
     * {@code (windowStart, windowEnd)} and whose status can clash. The window is wide enough to hold any hearing
     * that overlaps the interval; the exact overlap is decided by {@link ClashDetector}.
     */
    @Query("""
            select distinct h from Hearing h, CaseFile c, HearingLawyer l
            where c.id = h.caseId and l.hearingId = h.id
              and h.archivedAt is null and c.archivedAt is null and l.archivedAt is null
              and l.userId in :userIds
              and h.statusCode not in :nonClashingStatuses
              and h.startsAt > :windowStart and h.startsAt < :windowEnd
            """)
    List<Hearing> findClashCandidates(
            @Param("userIds") Collection<UUID> userIds,
            @Param("nonClashingStatuses") Collection<String> nonClashingStatuses,
            @Param("windowStart") Instant windowStart,
            @Param("windowEnd") Instant windowEnd);

    /** Not archived hearings that still have to happen, soonest first, for the case summaries. */
    @Query("""
            select h from Hearing h
            where h.caseId in :caseIds and h.archivedAt is null
              and h.startsAt >= :since and h.statusCode not in :closedStatuses
            order by h.startsAt, h.id
            """)
    List<Hearing> findUpcoming(
            @Param("caseIds") Collection<UUID> caseIds,
            @Param("since") Instant since,
            @Param("closedStatuses") Collection<String> closedStatuses);
}
