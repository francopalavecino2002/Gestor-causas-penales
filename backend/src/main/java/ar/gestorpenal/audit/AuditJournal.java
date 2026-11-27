package ar.gestorpenal.audit;

import jakarta.persistence.EntityManager;
import java.sql.PreparedStatement;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.hibernate.Session;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes a change history entry by hand, for a change that does not go through an {@link Audited}
 * entity: a firm's own settings live on the {@code tenant} row, which is not tenant-scoped. The entry
 * has the same shape as the automatic ones and commits or rolls back with the caller's transaction.
 */
@Component
public class AuditJournal {

    private final EntityManager entityManager;
    private final Clock clock;
    private final JsonMapper jsonMapper;

    AuditJournal(EntityManager entityManager, Clock clock, JsonMapper jsonMapper) {
        this.entityManager = entityManager;
        this.clock = clock;
        this.jsonMapper = jsonMapper;
    }

    /** An update of {@code entityClass} {@code entityId} of firm {@code tenantId}, by the logged-in user. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordUpdate(UUID tenantId, Class<?> entityClass, UUID entityId, List<FieldChange> changes) {
        writeEntry(tenantId, entityClass, entityId, AuditAction.UPDATE, changes);
    }

    /**
     * The creation of {@code entityClass} {@code entityId} of firm {@code tenantId}, by the logged-in
     * user, or by nobody (the system) when there is none, as in the first-firm bootstrap.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void recordCreate(UUID tenantId, Class<?> entityClass, UUID entityId, List<FieldChange> changes) {
        writeEntry(tenantId, entityClass, entityId, AuditAction.CREATE, changes);
    }

    private void writeEntry(
            UUID tenantId, Class<?> entityClass, UUID entityId, AuditAction action, List<FieldChange> changes) {
        String json = jsonMapper.writeValueAsString(changes);
        UUID actor = AuditRecorder.currentActor(tenantId);
        entityManager.unwrap(Session.class).doWork(connection -> {
            try (PreparedStatement insert = connection.prepareStatement(AuditRecorder.INSERT_SQL)) {
                insert.setObject(1, tenantId);
                insert.setObject(2, OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
                insert.setObject(3, actor);
                insert.setString(4, AuditRecorder.entityTypeOf(entityClass));
                insert.setObject(5, entityId);
                insert.setString(6, action.name());
                insert.setString(7, json);
                insert.executeUpdate();
            }
        });
    }
}
