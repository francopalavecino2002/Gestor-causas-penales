package ar.gestorpenal.aiassist;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface AiAssistUseRepository extends JpaRepository<AiAssistUse, UUID> {

    List<AiAssistUse> findAllByOrderByUsedAtDesc();

    /** Requests of the firm in scope since {@code since}, for the per-firm rate limit. */
    long countByUsedAtAfter(Instant since);
}
