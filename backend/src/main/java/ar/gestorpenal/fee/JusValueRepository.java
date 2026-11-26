package ar.gestorpenal.fee;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped by Hibernate (ADR-0007). */
interface JusValueRepository extends JpaRepository<JusValue, UUID> {

    List<JusValue> findAllByOrderByValidFromDescCreatedAtDesc();

    List<JusValue> findAllByArchivedAtIsNullOrderByValidFromDescCreatedAtDesc();

    /** The value that applies on a day: the latest active one that started on or before it. */
    Optional<JusValue> findFirstByArchivedAtIsNullAndValidFromLessThanEqualOrderByValidFromDesc(LocalDate day);

    boolean existsByArchivedAtIsNullAndValidFrom(LocalDate validFrom);
}
