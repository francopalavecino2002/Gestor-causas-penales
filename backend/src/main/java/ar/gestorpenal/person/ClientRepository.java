package ar.gestorpenal.person;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped by Hibernate: every query only sees the current firm's rows (ADR-0007). */
interface ClientRepository extends JpaRepository<Client, UUID> {

    Optional<Client> findByPersonId(UUID personId);

    List<Client> findByPersonIdIn(Collection<UUID> personIds);
}
