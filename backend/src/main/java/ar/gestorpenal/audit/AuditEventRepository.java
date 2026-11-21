package ar.gestorpenal.audit;

import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/** Read-only and tenant-scoped (ADR-0007). Writes go through {@link AuditRecorder}. */
interface AuditEventRepository extends Repository<AuditEvent, Long> {

    List<AuditEvent> findByEntityTypeAndEntityIdOrderByIdAsc(String entityType, UUID entityId);

    List<AuditEvent> findByActorUserIdOrderByIdAsc(UUID actorUserId);
}
