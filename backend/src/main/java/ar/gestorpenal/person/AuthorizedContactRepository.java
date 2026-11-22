package ar.gestorpenal.person;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped by Hibernate: every query only sees the current firm's rows (ADR-0007). */
interface AuthorizedContactRepository extends JpaRepository<AuthorizedContact, UUID> {

    List<AuthorizedContact> findByClientIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(UUID clientId);

    Optional<AuthorizedContact> findByIdAndClientId(UUID id, UUID clientId);
}
