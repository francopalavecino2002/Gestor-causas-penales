package ar.gestorpenal.casefile;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.Tenant;
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
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A case file, the legajo (ADR-0015). It holds what is common to the case; in an area with defendants
 * (criminal) the stage, status and outcome belong to each {@link Defendant}, and in any other area to
 * the case itself (ADR-0032). It belongs to one practice area (ADR-0032). Archived,
 * never deleted.
 */
@Entity
@Audited
@Table(name = "case_file")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class CaseFile extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Carátula. */
    @Column(nullable = false, length = 300)
    private String caption;

    @Column(name = "internal_number", length = 40)
    private String internalNumber;

    /** Normalized, see {@link MpfLegajo}. */
    @Column(name = "mpf_legajo", length = 40)
    private String mpfLegajo;

    @Column(name = "ofiju_number", length = 40)
    private String ofijuNumber;

    @Column(name = "pehuen_number", length = 40)
    private String pehuenNumber;

    /** The practice area (fuero) whose catalogs and modules the case uses; chosen once, never changes. */
    @Column(name = "practice_area", nullable = false, updatable = false, length = 40)
    private String practiceArea;

    @Column(name = "circumscription_code", nullable = false, length = 60)
    private String circumscriptionCode;

    /** Item of the area's {@code action-types} catalog. */
    @Column(name = "action_type", nullable = false, length = 60)
    private String actionType;

    /** Item of the area's {@code represented-sides} catalog. */
    @Column(nullable = false, length = 60)
    private String represents;

    /** The case's own stage, status and outcome: only in an area without defendants, else all {@code null}. */
    @Column(name = "stage_code", length = 60)
    private String stageCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private CaseStatus status;

    @Column(name = "closing_outcome_code", length = 60)
    private String closingOutcomeCode;

    @Column(nullable = false)
    private boolean reserved;

    /** The firm's custom field values by field key; validated by the service against the definitions. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_fields", nullable = false)
    private Map<String, Object> customFields = new LinkedHashMap<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static CaseFile create(CaseData data) {
        CaseFile caseFile = new CaseFile();
        caseFile.createdAt = Instant.now();
        String area = Text.clean(data.practiceArea());
        caseFile.practiceArea = area == null ? Tenant.DEFAULT_PRACTICE_AREA : area;
        caseFile.apply(data);
        return caseFile;
    }

    /** Replaces every editable field. The validation runs before anything is assigned. */
    void apply(CaseData data) {
        String caption = Text.clean(data.caption());
        String circumscription = Text.clean(data.circumscriptionCode());
        if (caption == null || circumscription == null) {
            throw new InvalidCaseDataException("A case needs a caption and a circumscription");
        }
        if (Text.clean(data.actionType()) == null || Text.clean(data.represents()) == null) {
            throw new InvalidCaseDataException("A case needs an action type and whom the firm represents");
        }
        String legajo = MpfLegajo.normalize(data.mpfLegajo());
        String area = Text.clean(data.practiceArea());
        if (area != null && !area.equals(practiceArea)) {
            throw new InvalidCaseDataException("The practice area of a case cannot change");
        }

        this.caption = caption;
        this.internalNumber = Text.clean(data.internalNumber());
        this.mpfLegajo = legajo;
        this.ofijuNumber = Text.clean(data.ofijuNumber());
        this.pehuenNumber = Text.clean(data.pehuenNumber());
        this.circumscriptionCode = circumscription;
        this.actionType = Text.clean(data.actionType());
        this.represents = Text.clean(data.represents());
        this.reserved = data.reservedOr(this.reserved);
    }

    /** Sets the case's own course, already checked against the area's catalogs; {@code null} for a criminal case. */
    void applyCourse(CaseCourse course) {
        this.stageCode = course == null ? null : course.stageCode();
        this.status = course == null ? null : course.status();
        this.closingOutcomeCode = course == null ? null : course.closingOutcomeCode();
    }

    /** Stores values already validated by {@code CustomFields}. */
    void replaceCustomFields(Map<String, Object> values) {
        this.customFields = new LinkedHashMap<>(values);
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
