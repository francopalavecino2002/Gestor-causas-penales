package ar.gestorpenal.audit;

import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.metamodel.EntityType;
import java.util.UUID;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.springframework.stereotype.Component;

/**
 * Plugs {@link AuditRecorder} and {@link DeletionGuard} into Hibernate when the application starts.
 * The startup fails if an {@link Audited} entity cannot be recorded: it must be tenant-scoped, have
 * a UUID id (because {@code audit_event} stores both) and only audit fields with a plain-text form.
 */
@Component
class AuditListenerRegistration {

    AuditListenerRegistration(
            EntityManagerFactory entityManagerFactory, AuditRecorder recorder, DeletionGuard deletionGuard) {
        SessionFactoryImplementor sessionFactory = entityManagerFactory.unwrap(SessionFactoryImplementor.class);
        for (EntityType<?> entity : entityManagerFactory.getMetamodel().getEntities()) {
            Class<?> type = entity.getJavaType();
            if (type.isAnnotationPresent(Audited.class)) {
                requireRecordable(type, entity.getIdType().getJavaType());
                recorder.prepare(sessionFactory.getMappingMetamodel().getEntityDescriptor(type));
            }
        }
        EventListenerRegistry registry =
                sessionFactory.getServiceRegistry().requireService(EventListenerRegistry.class);
        registry.appendListeners(EventType.POST_INSERT, recorder);
        registry.appendListeners(EventType.POST_UPDATE, recorder);
        registry.prependListeners(EventType.PRE_DELETE, deletionGuard);
    }

    static void requireRecordable(Class<?> entityType, Class<?> idType) {
        if (!TenantScopedEntity.class.isAssignableFrom(entityType) || idType != UUID.class) {
            throw new IllegalStateException(
                    "@Audited entity " + entityType.getName() + " must extend TenantScopedEntity and have a UUID id");
        }
    }
}
