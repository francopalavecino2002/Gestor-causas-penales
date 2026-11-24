package ar.gestorpenal.task;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Tenant-scoped by Hibernate (ADR-0007). The search also reads {@code CaseFile} and
 * {@code CaseTeamMember} by entity name, so a task of a reserved case the user cannot see is filtered
 * inside the query and the page and the total are right (as in the deadlines and the agenda).
 */
interface TaskRepository extends JpaRepository<Task, UUID> {

    /**
     * Each {@code filterX} flag switches its filter on, so no parameter is ever null. Order: overdue
     * first, then the soonest due day (tasks without one last), then the oldest.
     */
    @Query("""
            select t from Task t
            where (:includeArchived = true or t.archivedAt is null)
              and (:filterResponsible = false or t.responsibleUserId = :responsibleId)
              and (:filterCase = false or t.caseId = :caseId)
              and (:filterHearing = false or t.hearingId = :hearingId)
              and (:filterStatus = false or t.status = :status)
              and (:overdueOnly = false
                   or (t.status = ar.gestorpenal.task.TaskStatus.PENDING and t.archivedAt is null
                       and t.dueDate < :today))
              and (:filterDueOn = false or t.dueDate = :dueOn)
              and (t.caseId is null
                   or exists (select 1 from CaseFile c
                              where c.id = t.caseId
                                and (:seesEveryCase = true or c.reserved = false
                                     or exists (select 1 from CaseTeamMember m
                                                where m.caseId = c.id and m.userId = :userId
                                                  and m.archivedAt is null))))
            order by
              case when t.status = ar.gestorpenal.task.TaskStatus.PENDING and t.archivedAt is null
                        and t.dueDate < :today then 0 else 1 end,
              case when t.dueDate is null then 1 else 0 end,
              t.dueDate, t.createdAt, t.id
            """)
    Page<Task> search(
            @Param("includeArchived") boolean includeArchived,
            @Param("filterResponsible") boolean filterResponsible,
            @Param("responsibleId") UUID responsibleId,
            @Param("filterCase") boolean filterCase,
            @Param("caseId") UUID caseId,
            @Param("filterHearing") boolean filterHearing,
            @Param("hearingId") UUID hearingId,
            @Param("filterStatus") boolean filterStatus,
            @Param("status") TaskStatus status,
            @Param("overdueOnly") boolean overdueOnly,
            @Param("filterDueOn") boolean filterDueOn,
            @Param("dueOn") LocalDate dueOn,
            @Param("today") LocalDate today,
            @Param("seesEveryCase") boolean seesEveryCase,
            @Param("userId") UUID userId,
            Pageable pageable);
}
