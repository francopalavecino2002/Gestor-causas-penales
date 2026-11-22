package ar.gestorpenal.deadline;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface DeadlineExtensionRepository extends JpaRepository<DeadlineExtension, UUID> {

    /** Active extensions in the order they were granted: their position is their step. */
    List<DeadlineExtension> findByDeadlineIdInAndArchivedAtIsNullOrderByGrantedOnAscCreatedAtAscIdAsc(
            Collection<UUID> deadlineIds);
}
