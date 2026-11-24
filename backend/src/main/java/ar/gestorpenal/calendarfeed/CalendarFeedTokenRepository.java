package ar.gestorpenal.calendarfeed;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped like every repository: it only sees the current firm's links (ADR-0007). */
interface CalendarFeedTokenRepository extends JpaRepository<CalendarFeedToken, UUID> {

    Optional<CalendarFeedToken> findByUserIdAndRevokedAtIsNull(UUID userId);
}
