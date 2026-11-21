package ar.gestorpenal.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Tenant-scoped like every repository: it only sees users of the current firm (ADR-0007). */
public interface UserRepository extends JpaRepository<AppUser, UUID> {

    /** Expects an email already normalized with {@link UserService#normalizeEmail(String)}. */
    Optional<AppUser> findByEmail(String email);

    /**
     * Records {@code step} as the last used TOTP step only if it is newer than the stored one. A
     * single conditional update, so two concurrent requests cannot both use the same code.
     *
     * @return 1 if the step was accepted, 0 if it was already used (or an older step was given)
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update AppUser u set u.totpLastStep = :step
            where u.id = :id and u.totpSecret is not null
              and (u.totpLastStep is null or u.totpLastStep < :step)""")
    int advanceTotpStep(@Param("id") UUID id, @Param("step") long step);
}
