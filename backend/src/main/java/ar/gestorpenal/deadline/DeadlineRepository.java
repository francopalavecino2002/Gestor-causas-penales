package ar.gestorpenal.deadline;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Tenant-scoped by Hibernate (ADR-0007). The firm-wide query reads {@code CaseFile}, {@code Defendant}
 * and {@code CaseTeamMember} by entity name, so archived and reserved cases are filtered inside the
 * query, as in the detainee alerts (ADR-0016).
 */
interface DeadlineRepository extends JpaRepository<Deadline, UUID> {

    List<Deadline> findByCaseId(UUID caseId);

    List<Deadline> findByCaseIdAndArchivedAtIsNull(UUID caseId);

    /**
     * Deadlines that still run (not met, not archived) of cases and defendants that are not archived
     * and that the user may see (a reserved case only for the owner or its active team).
     */
    @Query("""
            select dl from Deadline dl, CaseFile c
            where c.id = dl.caseId
              and dl.archivedAt is null and dl.metOn is null and c.archivedAt is null
              and (dl.defendantId is null
                   or exists (select 1 from Defendant d where d.id = dl.defendantId and d.archivedAt is null))
              and (:seesEveryCase = true or c.reserved = false
                   or exists (select 1 from CaseTeamMember t
                              where t.caseId = c.id and t.userId = :userId and t.archivedAt is null))
            """)
    List<Deadline> findRunningVisible(@Param("seesEveryCase") boolean seesEveryCase, @Param("userId") UUID userId);
}
