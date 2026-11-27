package ar.gestorpenal.security;

import ar.gestorpenal.audit.AuditRedacted;
import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One password recovery link sent by email (ADR-0049). Only the SHA-256 of the secret is kept, and it
 * is left out of the change history; issuing, using and revoking the link are in the history. Never
 * deleted.
 */
@Entity
@Audited
@Table(name = "password_reset_token")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class PasswordResetToken extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @AuditRedacted
    @Column(name = "token_hash", nullable = false, updatable = false, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    PasswordResetToken(UUID userId, String tokenHash, Instant createdAt, Instant expiresAt) {
        this.userId = Objects.requireNonNull(userId, "userId");
        this.tokenHash = Objects.requireNonNull(tokenHash, "tokenHash");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt");
        this.expiresAt = Objects.requireNonNull(expiresAt, "expiresAt");
    }

    /** Neither used, revoked nor expired at {@code now}. */
    boolean isUsableAt(Instant now) {
        return usedAt == null && revokedAt == null && now.isBefore(expiresAt);
    }

    void markUsed(Instant now) {
        if (!isUsableAt(now)) {
            throw new IllegalStateException("The link is no longer usable");
        }
        usedAt = now;
    }

    void revoke(Instant now) {
        if (usedAt == null && revokedAt == null) {
            revokedAt = now;
        }
    }
}
