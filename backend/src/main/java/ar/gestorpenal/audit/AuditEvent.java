package ar.gestorpenal.audit;

import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One entry of the change history, read through JPA so the tenant filter applies (ADR-0007).
 * Entries are written only by {@link AuditRecorder} and the table rejects updates and deletes.
 */
@Entity
@Table(name = "audit_event")
@Immutable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditEvent extends TenantScopedEntity {

    @Id
    private Long id;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    /** {@code null} when the change was made without a logged-in user (seed data, jobs). */
    @Column(name = "actor_user_id")
    private UUID actorUserId;

    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AuditAction action;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<FieldChange> changes;
}
