package ar.gestorpenal.audit;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads the change history of the current firm, oldest first. */
@Service
public class AuditTrail {

    private final AuditEventRepository events;

    AuditTrail(AuditEventRepository events) {
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<AuditEvent> historyOf(Class<?> entityClass, UUID entityId) {
        return events.findByEntityTypeAndEntityIdOrderByIdAsc(AuditRecorder.entityTypeOf(entityClass), entityId);
    }

    @Transactional(readOnly = true)
    public List<AuditEvent> changesMadeBy(UUID userId) {
        return events.findByActorUserIdOrderByIdAsc(userId);
    }
}
