package ar.gestorpenal.news;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenant-scoped by Hibernate (ADR-0007). */
interface FirmPostRepository extends JpaRepository<FirmPost, UUID> {}
