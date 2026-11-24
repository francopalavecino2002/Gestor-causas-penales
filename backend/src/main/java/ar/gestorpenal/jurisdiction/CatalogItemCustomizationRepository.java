package ar.gestorpenal.jurisdiction;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Tenant-scoped by Hibernate: every query only sees the current firm's rows (ADR-0007). The practice
 * area is {@code null} for the catalogs shared by the whole jurisdiction, and a derived query with a
 * {@code null} argument matches {@code IS NULL}.
 */
interface CatalogItemCustomizationRepository extends JpaRepository<CatalogItemCustomization, UUID> {

    /** The rows of one area plus those of the shared catalogs. */
    List<CatalogItemCustomization> findByPracticeAreaOrPracticeAreaIsNullOrderByCreatedAtAscIdAsc(String practiceArea);

    List<CatalogItemCustomization> findByCatalogAndPracticeAreaOrderByCreatedAtAscIdAsc(
            Catalog catalog, String practiceArea);

    Optional<CatalogItemCustomization> findByCatalogAndPracticeAreaAndItemCode(
            Catalog catalog, String practiceArea, String itemCode);
}
