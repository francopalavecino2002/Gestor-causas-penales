package ar.gestorpenal.news;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Reads the entries of the wall from the audit log (ADR-0038) with one native query, so the kind of
 * each entry, archived records and reserved cases the user cannot see are all resolved inside the
 * database and the page and the total are right.
 *
 * <p>A native query is not filtered by Hibernate's tenant id, so every table is filtered by
 * {@code :tenantId} explicitly; the caller passes the tenant of the authenticated user.
 */
@Component
class NewsEvents {

    /**
     * Classifies the firm's audit entries about cases, hearings and posts. A hearing update is news
     * when it moved the date (only a reschedule changes {@code startsAt}) or set a status with a result.
     * {@code old_value} and {@code new_value} carry the changed date or status.
     */
    private static final String FEED = """
            with entry as (
                select e.id, e.occurred_at, e.actor_user_id, e.entity_id, e.changes,
                       case
                         when e.entity_type = 'CaseFile' and e.action = 'CREATE' then 'CASE_OPENED'
                         when e.entity_type = 'Hearing' and e.action = 'CREATE' then 'HEARING_SCHEDULED'
                         when e.entity_type = 'Hearing' and e.action = 'UPDATE'
                              and e.changes @> '[{"field": "startsAt"}]' then 'HEARING_RESCHEDULED'
                         when e.entity_type = 'Hearing' and e.action = 'UPDATE'
                              and exists (select 1 from jsonb_array_elements(e.changes) ch
                                          where ch ->> 'field' = 'statusCode'
                                            and ch ->> 'newValue' in (:resultStatuses)) then 'HEARING_RESULT'
                         when e.entity_type = 'FirmPost' and e.action = 'CREATE' then 'POST'
                       end as kind
                from audit_event e
                where e.tenant_id = :tenantId
                  and e.entity_type in ('CaseFile', 'Hearing', 'FirmPost')
                  and e.action in ('CREATE', 'UPDATE')
            ),
            visible_case as (
                select c.id from case_file c
                where c.tenant_id = :tenantId
                  and c.archived_at is null
                  and (:seesEveryCase = true or c.reserved = false
                       or exists (select 1 from case_team_member m
                                  where m.tenant_id = :tenantId and m.case_id = c.id
                                    and m.user_id = :userId and m.archived_at is null))
            ),
            feed as (
                select n.* from entry n
                where n.kind is not null
                  and case n.kind
                        when 'POST' then exists (select 1 from firm_post p
                                                 where p.tenant_id = :tenantId and p.id = n.entity_id
                                                   and p.archived_at is null)
                        when 'CASE_OPENED' then n.entity_id in (select id from visible_case)
                        else exists (select 1 from hearing h
                                     where h.tenant_id = :tenantId and h.id = n.entity_id
                                       and h.archived_at is null
                                       and h.case_id in (select id from visible_case))
                      end
            )
            """;

    private static final String PAGE = FEED + """
            select f.id, f.occurred_at, f.actor_user_id, f.entity_id, f.kind,
                   (select ch ->> 'oldValue' from jsonb_array_elements(f.changes) ch
                    where ch ->> 'field' = case f.kind when 'HEARING_RESCHEDULED' then 'startsAt' else 'statusCode' end
                    limit 1) as old_value,
                   (select ch ->> 'newValue' from jsonb_array_elements(f.changes) ch
                    where ch ->> 'field' = case f.kind when 'HEARING_RESCHEDULED' then 'startsAt' else 'statusCode' end
                    limit 1) as new_value
            from feed f
            order by f.id desc
            limit :limit offset :offset
            """;

    private static final String COUNT = FEED + "select count(*) from feed";

    private final EntityManager entityManager;

    NewsEvents(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** One entry of the wall as stored: the record it is about and, for hearing updates, the change. */
    record Event(long id, Instant occurredAt, UUID actorUserId, UUID entityId, NewsKind kind, String oldValue, String newValue) {}

    /** The newest entries first. */
    List<Event> page(Scope scope, int page, int size) {
        Query query = bind(entityManager.createNativeQuery(PAGE), scope)
                .setParameter("limit", size)
                .setParameter("offset", (long) page * size);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        return rows.stream().map(NewsEvents::event).toList();
    }

    long count(Scope scope) {
        return ((Number) bind(entityManager.createNativeQuery(COUNT), scope).getSingleResult()).longValue();
    }

    /**
     * Whose wall it is: the firm, and whether the user sees every case or only the reserved ones of
     * the teams they belong to.
     */
    record Scope(UUID tenantId, UUID userId, boolean seesEveryCase, Collection<String> resultStatuses) {}

    private static Query bind(Query query, Scope scope) {
        return query.setParameter("tenantId", scope.tenantId())
                .setParameter("userId", scope.userId())
                .setParameter("seesEveryCase", scope.seesEveryCase())
                .setParameter("resultStatuses", scope.resultStatuses());
    }

    private static Event event(Object[] row) {
        return new Event(
                ((Number) row[0]).longValue(),
                instant(row[1]),
                (UUID) row[2],
                (UUID) row[3],
                NewsKind.valueOf((String) row[4]),
                (String) row[5],
                (String) row[6]);
    }

    private static Instant instant(Object value) {
        return switch (value) {
            case Instant instant -> instant;
            case OffsetDateTime dateTime -> dateTime.toInstant();
            case Timestamp timestamp -> timestamp.toInstant();
            default -> throw new IllegalStateException("Unexpected timestamp type " + value.getClass());
        };
    }
}
