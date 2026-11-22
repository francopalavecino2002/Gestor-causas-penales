package ar.gestorpenal.casefile;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CasePartyRepository extends JpaRepository<CaseParty, UUID> {

    List<CaseParty> findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(UUID caseId);

    Optional<CaseParty> findByIdAndCaseId(UUID id, UUID caseId);

    boolean existsByCaseIdAndPersonIdAndRoleCodeAndArchivedAtIsNull(UUID caseId, UUID personId, String roleCode);

    List<CaseParty> findByPersonIdInAndArchivedAtIsNull(Collection<UUID> personIds);
}
