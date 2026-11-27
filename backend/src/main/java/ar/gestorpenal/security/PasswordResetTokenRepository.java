package ar.gestorpenal.security;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

/** Tenant-scoped like every repository: it only sees the current firm's links (ADR-0007). */
interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

    /** Locked until the transaction ends, so two requests with the same link cannot both use it. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    List<PasswordResetToken> findByUserIdAndUsedAtIsNullAndRevokedAtIsNull(UUID userId);
}
