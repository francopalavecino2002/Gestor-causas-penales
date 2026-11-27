package ar.gestorpenal.security;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Finds which firm a verification link belongs to, like {@link PasswordResetTokenLookup}: whoever opens
 * the link has no session yet, so this one query reads across firms and returns only the firm's id.
 */
@Component
class EmailVerificationTokenLookup {

    private final JdbcTemplate jdbc;

    EmailVerificationTokenLookup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The firm of the link, unless the firm is archived. Whether the link is usable is checked later. */
    Optional<UUID> findFirmOf(String tokenHash) {
        List<UUID> firms = jdbc.query(
                """
                select t.tenant_id
                from email_verification_token t
                join tenant f on f.id = t.tenant_id
                where t.token_hash = ? and f.archived_at is null
                """,
                (row, number) -> row.getObject("tenant_id", UUID.class),
                tokenHash);
        return firms.stream().findFirst();
    }
}
