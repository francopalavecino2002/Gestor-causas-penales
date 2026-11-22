package ar.gestorpenal.hearing;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface HearingDefendantRepository extends JpaRepository<HearingDefendant, UUID> {

    List<HearingDefendant> findByHearingIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(UUID hearingId);

    List<HearingDefendant> findByHearingIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(Collection<UUID> hearingIds);
}
