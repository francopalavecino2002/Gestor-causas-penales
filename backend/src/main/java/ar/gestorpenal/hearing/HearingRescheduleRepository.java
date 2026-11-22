package ar.gestorpenal.hearing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface HearingRescheduleRepository extends JpaRepository<HearingReschedule, UUID> {

    List<HearingReschedule> findByHearingIdOrderByCreatedAtDescIdDesc(UUID hearingId);
}
