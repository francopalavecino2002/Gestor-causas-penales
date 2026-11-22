package ar.gestorpenal.hearing;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CoerciveMeasureRiskRepository extends JpaRepository<CoerciveMeasureRisk, UUID> {

    List<CoerciveMeasureRisk> findByMeasureIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(UUID measureId);

    List<CoerciveMeasureRisk> findByMeasureIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(Collection<UUID> measureIds);
}
