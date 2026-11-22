package ar.gestorpenal.deadline;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface DeadlineSuspensionRepository extends JpaRepository<DeadlineSuspension, UUID> {

    List<DeadlineSuspension> findByCaseIdOrderByStartsOnAscIdAsc(UUID caseId);

    List<DeadlineSuspension> findByCaseIdAndArchivedAtIsNullOrderByStartsOnAscIdAsc(UUID caseId);

    List<DeadlineSuspension> findByCaseIdInAndArchivedAtIsNull(Collection<UUID> caseIds);
}
