package ar.gestorpenal.hearing;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Tenant-scoped by Hibernate (ADR-0007). The queries that follow a measure to its case read
 * {@code Defendant}, {@code CaseFile} and {@code CaseTeamMember} by entity name, so archived and
 * reserved cases are filtered inside the query (ADR-0016).
 */
interface CoerciveMeasureRepository extends JpaRepository<CoerciveMeasure, UUID> {

    List<CoerciveMeasure> findByDefendantIdOrderByStartsOnDescIdAsc(UUID defendantId);

    List<CoerciveMeasure> findByDefendantIdAndArchivedAtIsNullOrderByStartsOnDescIdAsc(UUID defendantId);

    /**
     * Defendants (of {@code defendantIds}) with an active measure whose code is in {@code measureCodes}.
     * Active means not archived, not lifted and already started on {@code today}: a measure ordered
     * ahead does not detain yet.
     */
    @Query("""
            select distinct m.defendantId from CoerciveMeasure m
            where m.defendantId in :defendantIds and m.measureCode in :measureCodes
              and m.archivedAt is null and m.liftedOn is null and m.startsOn <= :today
            """)
    List<UUID> findDefendantsWithActiveMeasure(
            @Param("defendantIds") Collection<UUID> defendantIds,
            @Param("measureCodes") Collection<String> measureCodes,
            @Param("today") LocalDate today);

    /**
     * Per case: how many active defendants have an active measure (started by {@code today}) with one of
     * {@code measureCodes}. Rows are {@code [caseId, count]}.
     */
    @Query("""
            select d.caseId, count(distinct d.id) from CoerciveMeasure m, Defendant d
            where d.id = m.defendantId and d.caseId in :caseIds
              and d.archivedAt is null and m.archivedAt is null and m.liftedOn is null
              and m.startsOn <= :today and m.measureCode in :measureCodes
            group by d.caseId
            """)
    List<Object[]> countDetaineesByCase(
            @Param("caseIds") Collection<UUID> caseIds,
            @Param("measureCodes") Collection<String> measureCodes,
            @Param("today") LocalDate today);

    /**
     * Active measures (started by {@code today}) with one of {@code measureCodes} whose defendant and case are not archived and
     * that the user may see (a reserved case only for the owner or its active team).
     */
    @Query("""
            select m from CoerciveMeasure m, Defendant d, CaseFile c
            where d.id = m.defendantId and c.id = d.caseId
              and m.archivedAt is null and m.liftedOn is null and m.startsOn <= :today
              and m.measureCode in :measureCodes
              and d.archivedAt is null and c.archivedAt is null
              and (:seesEveryCase = true or c.reserved = false
                   or exists (select 1 from CaseTeamMember t
                              where t.caseId = c.id and t.userId = :userId and t.archivedAt is null))
            """)
    List<CoerciveMeasure> findActiveVisible(
            @Param("measureCodes") Collection<String> measureCodes,
            @Param("today") LocalDate today,
            @Param("seesEveryCase") boolean seesEveryCase,
            @Param("userId") UUID userId);
}
