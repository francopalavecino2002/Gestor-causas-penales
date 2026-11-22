package ar.gestorpenal.hearing;

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
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A coercive measure ordered against a defendant (ADR-0016). Active while it is neither archived nor
 * lifted. Catalog codes, the case's action type and the ordering hearing are checked by
 * {@link CoerciveMeasureService}; the rules on the data itself are checked here, before anything is
 * assigned.
 */
@Entity
@Audited
@Table(name = "coercive_measure")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class CoerciveMeasure extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "defendant_id", nullable = false, updatable = false)
    private UUID defendantId;

    @Column(name = "measure_code", nullable = false, length = 60)
    private String measureCode;

    @Column
    private String conditions;

    @Column(name = "detention_place", length = 200)
    private String detentionPlace;

    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;

    /** Fixed duration (art. 116). */
    @Column(name = "ends_on")
    private LocalDate endsOn;

    @Column(name = "next_review_on")
    private LocalDate nextReviewOn;

    @Column(name = "ordered_by_hearing_id")
    private UUID orderedByHearingId;

    /** Cese. */
    @Column(name = "lifted_on")
    private LocalDate liftedOn;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static CoerciveMeasure create(UUID defendantId, CoerciveMeasureData data) {
        CoerciveMeasure measure = new CoerciveMeasure();
        measure.defendantId = defendantId;
        measure.createdAt = Instant.now();
        measure.apply(data);
        return measure;
    }

    /** Replaces every editable field. The validation runs before anything is assigned. */
    void apply(CoerciveMeasureData data) {
        String code = Text.clean(data.measureCode());
        String place = Text.clean(data.detentionPlace());
        List<String> risks = data.risks();
        if (place != null && !CustodialMeasures.isCustodial(code)) {
            throw new InvalidHearingDataException(
                    "A detention place only applies to preventive prison or house arrest");
        }
        if (!risks.isEmpty() && !CustodialMeasures.PREVENTIVE_PRISON.equals(code)) {
            throw new InvalidHearingDataException("Procedural risks only apply to preventive prison (art. 115)");
        }
        LocalDate start = data.startsOn();
        requireNotBefore("The end date", data.endsOn(), start);
        requireNotBefore("The next review", data.nextReviewOn(), start);
        requireNotBefore("The day it was lifted", liftedOn, start);

        this.measureCode = code;
        this.conditions = Text.clean(data.conditions());
        this.detentionPlace = place;
        this.startsOn = start;
        this.endsOn = data.endsOn();
        this.nextReviewOn = data.nextReviewOn();
        this.orderedByHearingId = data.orderedByHearingId();
    }

    /** Ends the measure on {@code day}, which is neither before it started nor after {@code today}. */
    void lift(LocalDate day, LocalDate today) {
        if (liftedOn != null) {
            throw new HearingStateException("The measure is already lifted");
        }
        requireNotBefore("The day it was lifted", day, startsOn);
        if (day.isAfter(today)) {
            throw new InvalidHearingDataException("A measure cannot be lifted on a future day");
        }
        this.liftedOn = day;
    }

    boolean isActive() {
        return archivedAt == null && liftedOn == null;
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

    private static void requireNotBefore(String what, LocalDate day, LocalDate start) {
        if (day != null && day.isBefore(start)) {
            throw new InvalidHearingDataException(what + " cannot be before the measure starts");
        }
    }
}
