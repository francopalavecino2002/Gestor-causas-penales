package ar.gestorpenal.task;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A to-do of the firm with a responsible member, optionally tied to a case or one of its hearings.
 * Archived, never deleted. The service checks the references (member, case, hearing); the entity
 * keeps its own data consistent.
 */
@Entity
@Audited
@Table(name = "task")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Task extends TenantScopedEntity {

    static final LocalDate FIRST_DUE_DATE = LocalDate.of(1990, 1, 1);
    static final LocalDate LAST_DUE_DATE = LocalDate.of(2100, 12, 31);

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column
    private String notes;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "responsible_user_id", nullable = false)
    private UUID responsibleUserId;

    @Column(name = "case_id")
    private UUID caseId;

    @Column(name = "hearing_id")
    private UUID hearingId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status;

    @Column(name = "done_at")
    private Instant doneAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    /** A pending task; {@code caseId} is the already-resolved case of the data (or of its hearing). */
    static Task create(UUID createdBy, TaskData data, UUID caseId, Instant now) {
        Task task = new Task();
        task.createdBy = createdBy;
        task.createdAt = now;
        task.status = TaskStatus.PENDING;
        task.apply(data, caseId);
        return task;
    }

    /** Replaces the editable fields; the validation runs before anything is assigned. */
    void apply(TaskData data, UUID caseId) {
        String cleanTitle = Text.clean(data.title());
        if (cleanTitle == null) {
            throw new InvalidTaskDataException("The task needs a title");
        }
        if (data.dueDate() != null && (data.dueDate().isBefore(FIRST_DUE_DATE) || data.dueDate().isAfter(LAST_DUE_DATE))) {
            throw new InvalidTaskDataException("dueDate must be between " + FIRST_DUE_DATE + " and " + LAST_DUE_DATE);
        }
        this.title = cleanTitle;
        this.notes = Text.clean(data.notes());
        this.dueDate = data.dueDate();
        this.responsibleUserId = data.responsibleUserId();
        this.caseId = caseId;
        this.hearingId = data.hearingId();
    }

    /** Overdue: still pending, not archived and due before {@code today}. */
    boolean isOverdue(LocalDate today) {
        return status == TaskStatus.PENDING && archivedAt == null && dueDate != null && dueDate.isBefore(today);
    }

    void markDone(Instant now) {
        if (status != TaskStatus.DONE) {
            status = TaskStatus.DONE;
            doneAt = now;
        }
    }

    void reopen() {
        status = TaskStatus.PENDING;
        doneAt = null;
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive(Instant now) {
        if (archivedAt == null) {
            archivedAt = now;
        }
    }

    void restore() {
        archivedAt = null;
    }
}
