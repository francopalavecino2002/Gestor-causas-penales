package ar.gestorpenal.user;

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

/** A member of one firm. Created through {@link UserService}, which hashes the password. */
@Entity
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
    @Column(name = "totp_secret")
    private String totpSecret;

    @Column(name = "totp_enabled_at")
    private Instant totpEnabledAt;

    /** Last accepted TOTP step, advanced atomically by {@link UserRepository#advanceTotpStep}. */
    @Column(name = "totp_last_step")
    private Long totpLastStep;

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
