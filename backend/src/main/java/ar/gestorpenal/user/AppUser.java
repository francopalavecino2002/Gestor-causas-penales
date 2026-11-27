package ar.gestorpenal.user;

import ar.gestorpenal.audit.AuditRedacted;
import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.audit.NotAudited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * A member of one firm. Created through {@link UserService}, which hashes the password. Changes are
 * recorded in the history without the secrets' values (ADR-0010).
 */
@Entity
@Audited
@Table(name = "app_user")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AppUser extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @AuditRedacted
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    /** Encrypted TOTP secret; present while enrolling and once two-factor is enabled (ADR-0009). */
    @AuditRedacted
    @Column(name = "totp_secret")
    private String totpSecret;

    @Column(name = "totp_enabled_at")
    private Instant totpEnabledAt;

    /** Last accepted TOTP step, advanced atomically by {@link UserRepository#advanceTotpStep}. */
    @NotAudited
    @Column(name = "totp_last_step")
    private Long totpLastStep;

    /** Set for a temporary password chosen by the owner: the user must replace it first (ADR-0044). */
    @Column(name = "password_change_required", nullable = false)
    private boolean passwordChangeRequired;

    /** When the password last changed; sessions opened before it are no longer valid. */
    @Column(name = "credentials_changed_at")
    private Instant credentialsChangedAt;

    /** Set for the owner of a firm that signed up by itself until they open the emailed link (ADR-0050). */
    @Column(name = "email_verification_pending", nullable = false)
    private boolean emailVerificationPending;

    AppUser(String email, String displayName, String passwordHash, Role role) {
        this.email = Objects.requireNonNull(email, "email");
        this.displayName = Objects.requireNonNull(displayName, "displayName");
        this.passwordHash = Objects.requireNonNull(passwordHash, "passwordHash");
        this.role = Objects.requireNonNull(role, "role");
        this.createdAt = Instant.now();
    }

    public boolean isActive() {
        return archivedAt == null;
    }

    /** Users are never deleted; an archived user can no longer log in. */
    public void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }

    void restore() {
        archivedAt = null;
    }

    void changeRole(Role newRole) {
        this.role = Objects.requireNonNull(newRole, "role");
    }

    /**
     * Replaces the password hash. A temporary one (set by the owner) must be changed by the user
     * before anything else; either way, sessions opened before {@code now} end.
     */
    void replacePassword(String newPasswordHash, boolean temporary, Instant now) {
        this.passwordHash = Objects.requireNonNull(newPasswordHash, "newPasswordHash");
        this.passwordChangeRequired = temporary;
        this.credentialsChangedAt = Objects.requireNonNull(now, "now");
    }

    void requireEmailVerification() {
        this.emailVerificationPending = true;
    }

    /** The user proved they own the email: they can log in from now on. */
    public void markEmailVerified() {
        this.emailVerificationPending = false;
    }

    /** Whether a session opened at {@code authenticatedAt} predates the last password change. */
    public boolean credentialsChangedAfter(Instant authenticatedAt) {
        return credentialsChangedAt != null && authenticatedAt.isBefore(credentialsChangedAt);
    }

    public boolean isTotpEnabled() {
        return totpEnabledAt != null;
    }

    /** Replaces any unconfirmed secret; two-factor stays off until {@link #enableTotp} is called. */
    public void startTotpEnrollment(String encryptedSecret) {
        if (isTotpEnabled()) {
            throw new IllegalStateException("Two-factor authentication is already enabled");
        }
        this.totpSecret = Objects.requireNonNull(encryptedSecret, "encryptedSecret");
        this.totpLastStep = null;
    }

    public void enableTotp(Instant now) {
        if (totpSecret == null || isTotpEnabled()) {
            throw new IllegalStateException("No two-factor enrollment in progress");
        }
        this.totpEnabledAt = Objects.requireNonNull(now, "now");
    }

    public void disableTotp() {
        this.totpSecret = null;
        this.totpEnabledAt = null;
        this.totpLastStep = null;
    }
}
