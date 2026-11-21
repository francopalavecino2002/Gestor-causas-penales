package ar.gestorpenal.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped like every repository: it only sees users of the current firm (ADR-0007). */
public interface UserRepository extends JpaRepository<AppUser, UUID> {

    /** Expects an email already normalized with {@link UserService#normalizeEmail(String)}. */
    Optional<AppUser> findByEmail(String email);
}
