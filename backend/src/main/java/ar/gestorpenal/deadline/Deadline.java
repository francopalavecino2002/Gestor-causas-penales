package ar.gestorpenal.deadline;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One concrete deadline of a case (ADR-0017). It stores the rule code and the dates the lawyer
 * loaded; the due date is computed on read by {@link DeadlineCalculator}, so a correction to a
 * suspension or an extension is reflected at once. Archived, never deleted.
 */
@Entity
@Audited
@Table(name = "deadline")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Deadline extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(name = "defendant_id", updatable = false)
    private UUID defendantId;

    @Column(name = "rule_code", nullable = false, updatable = false, length = 60)
    private String ruleCode;

    @Column(name = "triggered_on", nullable = false)
    private LocalDate triggeredOn;

    @Column(name = "triggered_at")
    private Instant triggeredAt;

    @Column(name = "set_due_on")
    private LocalDate setDueOn;

    @Column(name = "hearing_id")
    private UUID hearingId;

    @Column(name = "met_on")
    private LocalDate metOn;

    @Column
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static Deadline create(UUID caseId, UUID defendantId, DeadlineRule rule, DeadlineData data, ZoneId zone, LocalDate today) {
        Deadline deadline = new Deadline();
        deadline.caseId = caseId;
        deadline.defendantId = defendantId;
        deadline.ruleCode = rule.code();
        deadline.createdAt = Instant.now();
        deadline.apply(rule, data, zone, today);
        return deadline;
    }

    /**
     * Replaces the dates, the hearing and the notes. The validation runs before anything is assigned,
     * so a rejected change leaves the deadline untouched.
     */
    void apply(DeadlineRule rule, DeadlineData data, ZoneId zone, LocalDate today) {
        LocalDate day;
        Instant instant = null;
        if (rule.computation() == Computation.HOURS) {
            if (data.triggeredAt() == null) {
                throw new InvalidDeadlineDataException("A term in hours needs triggeredAt: the instant it started");
            }
            instant = data.triggeredAt();
            SupportedDates.require("triggeredAt", instant);
            day = instant.atZone(zone).toLocalDate();
            if (data.triggeredOn() != null && !data.triggeredOn().equals(day)) {
                throw new InvalidDeadlineDataException("triggeredOn must be the local day of triggeredAt, or be omitted");
            }
        } else {
            if (data.triggeredAt() != null) {
                throw new InvalidDeadlineDataException("Only a term in hours takes triggeredAt; send triggeredOn");
            }
            if (data.triggeredOn() == null) {
                throw new InvalidDeadlineDataException("The deadline needs triggeredOn: the day it started");
            }
            day = data.triggeredOn();
        }
        SupportedDates.require("triggeredOn", day);
        SupportedDates.require("setDueOn", data.setDueOn());
        boolean setByCourt = rule.computation() == Computation.SET_BY_COURT;
        if (setByCourt && data.setDueOn() == null) {
            throw new InvalidDeadlineDataException("A judicial deadline needs setDueOn: the date the court set");
        }
        if (!setByCourt && data.setDueOn() != null) {
            throw new InvalidDeadlineDataException("Only a judicial deadline takes setDueOn: this one is computed");
        }
        if (setByCourt && data.setDueOn().isBefore(day)) {
            throw new InvalidDeadlineDataException("The date the court set cannot be before the day it started");
        }
        if (data.metOn() != null && (data.metOn().isBefore(day) || data.metOn().isAfter(today))) {
            throw new InvalidDeadlineDataException("metOn cannot be before the deadline started or in the future");
        }

        this.triggeredOn = day;
        this.triggeredAt = instant;
        this.setDueOn = data.setDueOn();
        this.hearingId = data.hearingId();
        this.metOn = data.metOn();
        this.notes = Text.clean(data.notes());
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }

    void restore() {
        archivedAt = null;
    }
}
