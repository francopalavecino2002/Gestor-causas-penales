package ar.gestorpenal.casefile;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CaseTeamMemberRepository extends JpaRepository<CaseTeamMember, UUID> {

    List<CaseTeamMember> findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(UUID caseId);

    boolean existsByCaseIdAndUserIdAndArchivedAtIsNull(UUID caseId, UUID userId);
}
