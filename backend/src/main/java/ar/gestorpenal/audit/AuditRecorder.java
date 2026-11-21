package ar.gestorpenal.audit;

import ar.gestorpenal.tenancy.TenantScopedEntity;
import java.lang.reflect.Field;
import java.sql.PreparedStatement;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.Temporal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.IntStream;
import org.hibernate.annotations.TenantId;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.persister.entity.EntityPersister;
import org.hibernate.proxy.HibernateProxy;
import org.hibernate.type.Type;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.ReflectionUtils;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes one {@link AuditEvent} for every insert and update of an {@link Audited} entity
 * (ADR-0010).
 *
 * <p>Hibernate calls it during the flush, right after the entity's own SQL statement and on the
 * same connection, so the history entry commits or rolls back together with the change. Entities
 * cannot be persisted in the middle of a flush, so the entry is written with plain JDBC; its
 * {@code tenant_id} is taken from the audited entity itself.
 *
 * <p>Bulk JPQL or native {@code UPDATE} statements do not go through the entity lifecycle and are
 * <em>not</em> audited. Use them only for {@link NotAudited} technical state.
 */
@Component
class AuditRecorder implements PostInsertEventListener, PostUpdateEventListener {

    static final String ARCHIVED_AT = "archivedAt";

    private static final String INSERT_SQL = """
            insert into audit_event
                (tenant_id, occurred_at, actor_user_id, entity_type, entity_id, action, changes)
            values (?, ?, ?, ?, ?, ?, ?::jsonb)
            """;

    private final Clock clock;
    private final JsonMapper jsonMapper;
    private final Map<Class<?>, FieldPolicy[]> policies = new ConcurrentHashMap<>();

    AuditRecorder(Clock clock, JsonMapper jsonMapper) {
        this.clock = clock;
        this.jsonMapper = jsonMapper;
    }

    /** The name stored in {@code entity_type}: the entity's simple class name, as in JPA. */
    static String entityTypeOf(Class<?> entityClass) {
        return entityClass.getSimpleName();
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        EntityPersister persister = event.getPersister();
        if (!isAudited(persister)) {
            return;
        }
        Object[] state = event.getState();
        List<FieldChange> changes = new ArrayList<>();
        for (int i = 0; i < state.length; i++) {
            if (state[i] != null) {
                addChange(changes, persister, event.getSession(), i, null, state[i]);
            }
        }
        write(event.getSession(), persister, event.getEntity(), event.getId(), AuditAction.CREATE, changes);
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        EntityPersister persister = event.getPersister();
        if (!isAudited(persister)) {
            return;
        }
        Object[] oldState = event.getOldState();
        Object[] state = event.getState();
        List<FieldChange> changes = new ArrayList<>();
        AuditAction action = AuditAction.UPDATE;
        for (int i : changedProperties(event)) {
            Object oldValue = oldState == null ? null : oldState[i];
            if (addChange(changes, persister, event.getSession(), i, oldValue, state[i])
                    && ARCHIVED_AT.equals(persister.getPropertyNames()[i])) {
                action = state[i] != null ? AuditAction.ARCHIVE : AuditAction.RESTORE;
            }
        }
        if (!changes.isEmpty()) {
            write(event.getSession(), persister, event.getEntity(), event.getId(), action, changes);
        }
    }

    /** Hibernate's own dirty check when it ran, otherwise a value comparison of both states. */
    private static int[] changedProperties(PostUpdateEvent event) {
        if (event.getDirtyProperties() != null) {
            return event.getDirtyProperties();
        }
        Object[] oldState = event.getOldState();
        Object[] state = event.getState();
        return IntStream.range(0, state.length)
                .filter(i -> oldState == null || !Objects.equals(oldState[i], state[i]))
                .toArray();
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }

    private static boolean isAudited(EntityPersister persister) {
        return persister.getMappedClass().isAnnotationPresent(Audited.class);
    }

    /** Adds the change of property {@code index} unless the field is not audited; tells if it did. */
    private boolean addChange(
            List<FieldChange> changes,
            EntityPersister persister,
            SharedSessionContractImplementor session,
            int index,
            Object oldValue,
            Object newValue) {
        FieldPolicy policy = policiesOf(persister)[index];
        if (policy == FieldPolicy.SKIP) {
            return false;
        }
        String field = persister.getPropertyNames()[index];
        Type type = persister.getPropertyTypes()[index];
        if (policy == FieldPolicy.REDACT) {
            changes.add(new FieldChange(field, redacted(oldValue), redacted(newValue)));
        } else {
            changes.add(new FieldChange(field, describe(oldValue, type, session), describe(newValue, type, session)));
        }
        return true;
    }

    /** Resolves and validates the field policies of an audited entity, so mistakes fail at startup. */
    void prepare(EntityPersister persister) {
        policiesOf(persister);
    }

    private FieldPolicy[] policiesOf(EntityPersister persister) {
        return policies.computeIfAbsent(persister.getMappedClass(), entityClass -> {
            String[] names = persister.getPropertyNames();
            Type[] types = persister.getPropertyTypes();
            FieldPolicy[] result = new FieldPolicy[names.length];
            for (int i = 0; i < names.length; i++) {
                result[i] = types[i].isCollectionType() ? FieldPolicy.SKIP : FieldPolicy.of(entityClass, names[i]);
                if (result[i] == FieldPolicy.AUDIT && !isDescribable(types[i])) {
                    throw new IllegalStateException(entityClass.getName() + "." + names[i]
                            + " cannot be audited as text: mark it @NotAudited or @AuditRedacted");
                }
            }
            return result;
        });
    }

    private static boolean isDescribable(Type type) {
        return type.isEntityType() || hasTextForm(type.getReturnedClass());
    }

    /** Values with a faithful plain-text form: scalars, enums, times and ids. */
    static boolean hasTextForm(Class<?> javaType) {
        return javaType.isPrimitive()
                || CharSequence.class.isAssignableFrom(javaType)
                || Number.class.isAssignableFrom(javaType)
                || Boolean.class == javaType
                || javaType.isEnum()
                || UUID.class == javaType
                || Temporal.class.isAssignableFrom(javaType);
    }

    private static String redacted(Object value) {
        return value == null ? null : FieldChange.REDACTED;
    }

    /** Plain text of a value; an associated entity is represented by its id. */
    private static String describe(Object value, Type type, SharedSessionContractImplementor session) {
        if (value == null) {
            return null;
        }
        if (value instanceof HibernateProxy proxy) {
            return String.valueOf(proxy.getHibernateLazyInitializer().getInternalIdentifier());
        }
        if (type.isEntityType()) {
            return String.valueOf(session.getEntityPersister(null, value).getIdentifier(value, session));
        }
        if (value instanceof Enum<?> constant) {
            return constant.name();
        }
        return value.toString();
    }

    private void write(
            SharedSessionContractImplementor session,
            EntityPersister persister,
            Object entity,
            Object id,
            AuditAction action,
            List<FieldChange> changes) {
        UUID tenantId = ((TenantScopedEntity) entity).getTenantId();
        Instant now = clock.instant();
        String json = jsonMapper.writeValueAsString(changes);
        session.doWork(connection -> {
            try (PreparedStatement insert = connection.prepareStatement(INSERT_SQL)) {
                insert.setObject(1, tenantId);
                insert.setObject(2, OffsetDateTime.ofInstant(now, ZoneOffset.UTC));
                insert.setObject(3, currentActor(tenantId));
                insert.setString(4, entityTypeOf(persister.getMappedClass()));
                insert.setObject(5, (UUID) id);
                insert.setString(6, action.name());
                insert.setString(7, json);
                insert.executeUpdate();
            }
        });
    }

    /** The logged-in user, who must belong to the firm that owns the changed record. */
    private static UUID currentActor(UUID entityTenantId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof AuditActor actor)) {
            return null;
        }
        if (!entityTenantId.equals(actor.tenantId())) {
            throw new IllegalStateException("A user cannot change records of another firm");
        }
        return actor.userId();
    }

    private enum FieldPolicy {
        AUDIT,
        REDACT,
        SKIP;

        static FieldPolicy of(Class<?> entityClass, String propertyName) {
            Field field = ReflectionUtils.findField(entityClass, propertyName);
            if (field == null
                    || field.isAnnotationPresent(NotAudited.class)
                    || field.isAnnotationPresent(TenantId.class)) {
                return SKIP;
            }
            return field.isAnnotationPresent(AuditRedacted.class) ? REDACT : AUDIT;
        }
    }
}
