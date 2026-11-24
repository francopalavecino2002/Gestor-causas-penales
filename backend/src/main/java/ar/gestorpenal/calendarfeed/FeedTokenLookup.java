package ar.gestorpenal.calendarfeed;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Finds whose feed a secret opens. A calendar app calls without a session, so the firm is not known
 * yet and the tenant-scoped repositories would see nothing: this one query reads across firms, like
 * the login lookup by slug, and returns only the two ids needed to enter that firm's scope.
 */
@Component
class FeedTokenLookup {

    record Owner(UUID tenantId, UUID userId) {}

    private final JdbcTemplate jdbc;

    FeedTokenLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The owner of a live link of a firm that is not archived. */
    Optional<Owner> findLive(String tokenHash) {
        List<Owner> owners = jdbc.query(
                """
                select t.tenant_id, t.user_id
                from calendar_feed_token t
                join tenant f on f.id = t.tenant_id
                where t.token_hash = ? and t.revoked_at is null and f.archived_at is null
                """,
                (row, number) -> new Owner(row.getObject("tenant_id", UUID.class), row.getObject("user_id", UUID.class)),
                tokenHash);
        return owners.stream().findFirst();
    }
}
