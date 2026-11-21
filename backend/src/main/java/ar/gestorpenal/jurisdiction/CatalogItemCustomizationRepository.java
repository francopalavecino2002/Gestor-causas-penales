package ar.gestorpenal.jurisdiction;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped by Hibernate: every query only sees the current firm's rows (ADR-0007). */
interface CatalogItemCustomizationRepository extends JpaRepository<CatalogItemCustomization, UUID> {

    List<CatalogItemCustomization> findAllByOrderByCreatedAtAscIdAsc();

    List<CatalogItemCustomization> findByCatalogOrderByCreatedAtAscIdAsc(Catalog catalog);

    Optional<CatalogItemCustomization> findByCatalogAndItemCode(Catalog catalog, String itemCode);
}
