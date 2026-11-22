package ar.gestorpenal.hearing;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface HearingLawyerRepository extends JpaRepository<HearingLawyer, UUID> {

    List<HearingLawyer> findByHearingIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(UUID hearingId);

    List<HearingLawyer> findByHearingIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(Collection<UUID> hearingIds);
}
