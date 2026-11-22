package ar.gestorpenal.casefile;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface DefendantChargeRepository extends JpaRepository<DefendantCharge, UUID> {

    List<DefendantCharge> findByDefendantIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(Collection<UUID> defendantIds);

    Optional<DefendantCharge> findByIdAndDefendantId(UUID id, UUID defendantId);
}
