package ar.gestorpenal.casefile;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface DefendantRepository extends JpaRepository<Defendant, UUID> {

    List<Defendant> findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(UUID caseId);

    List<Defendant> findByCaseIdInAndArchivedAtIsNull(Collection<UUID> caseIds);

    Optional<Defendant> findByIdAndCaseId(UUID id, UUID caseId);

    boolean existsByCaseIdAndPersonIdAndArchivedAtIsNull(UUID caseId, UUID personId);

    List<Defendant> findByPersonIdInAndArchivedAtIsNull(Collection<UUID> personIds);
}
