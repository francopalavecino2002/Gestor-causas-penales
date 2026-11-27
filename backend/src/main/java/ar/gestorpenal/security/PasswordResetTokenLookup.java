package ar.gestorpenal.security;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Finds which firm a recovery link belongs to. Whoever opens the link has no session, so the firm is
 * not known yet and the tenant-scoped repositories would see nothing: this one query reads across
 * firms, like the login lookup by slug, and returns only the id needed to enter that firm's scope.
 */
@Component
class PasswordResetTokenLookup {

    private final JdbcTemplate jdbc;

    PasswordResetTokenLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The firm of the link, unless the firm is archived. Whether the link is usable is checked later. */
    Optional<UUID> findFirmOf(String tokenHash) {
        List<UUID> firms = jdbc.query(
                """
                select t.tenant_id
                from password_reset_token t
                join tenant f on f.id = t.tenant_id
                where t.token_hash = ? and f.archived_at is null
                """,
                (row, number) -> row.getObject("tenant_id", UUID.class),
                tokenHash);
        return firms.stream().findFirst();
    }
}
