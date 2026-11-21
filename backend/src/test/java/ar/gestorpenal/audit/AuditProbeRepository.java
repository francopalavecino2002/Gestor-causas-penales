package ar.gestorpenal.audit;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface AuditProbeRepository extends JpaRepository<AuditProbe, UUID> {}
