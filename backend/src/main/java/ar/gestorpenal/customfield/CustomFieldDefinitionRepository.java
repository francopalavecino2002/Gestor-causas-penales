package ar.gestorpenal.customfield;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface CustomFieldDefinitionRepository extends JpaRepository<CustomFieldDefinition, UUID> {

    /** Every definition of the record, archived ones included, in display order. */
    List<CustomFieldDefinition> findByEntityTypeOrderByPositionAscCreatedAtAscIdAsc(CustomFieldEntity entityType);

    long countByEntityTypeAndArchivedAtIsNull(CustomFieldEntity entityType);
}
