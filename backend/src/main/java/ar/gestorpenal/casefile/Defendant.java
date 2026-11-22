package ar.gestorpenal.casefile;

import ar.gestorpenal.audit.AuditRedacted;
import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.person.PersonKind;
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
 * A person accused in a case, with their own course: stage, status, outcome, defence counsel and
 * rebellion (ADR-0015). Archived, never deleted. The codes are checked against the firm's catalogs
 * by {@link DefendantService}; the rules that need no catalog are checked here.
 */
@Entity
@Audited
@Table(name = "defendant")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Defendant extends TenantScopedEntity {

    static final String DEFAULT_STAGE = "averiguacion-preliminar";
    static final String CLOSED_STAGE = "cerrada";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(name = "person_id", nullable = false, updatable = false)
    private UUID personId;

    @Column(name = "stage_code", nullable = false, length = 60)
    private String stageCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DefendantStatus status;

    @Column(name = "closing_outcome_code", length = 60)
    private String closingOutcomeCode;

    /** Formulación de cargos (art. 133). */
    @Column(name = "charges_formulated_on")
    private LocalDate chargesFormulatedOn;

    @Column(name = "defended_by_firm", nullable = false)
    private boolean defendedByFirm;

    @Enumerated(EnumType.STRING)
    @Column(name = "defence_counsel_kind", length = 10)
    private CounselKind defenceCounselKind;

    @Column(name = "defence_counsel_name", length = 200)
    private String defenceCounselName;

    /** Rebeldía (art. 52): suspends the term only for this defendant. */
    @Column(name = "rebellion_declared_on")
    private LocalDate rebellionDeclaredOn;

    @Column(name = "rebellion_lifted_on")
    private LocalDate rebellionLiftedOn;

    /** Pertenencia a pueblo indígena: sensitive data (Ley 25.326, art. 2), so the history never shows it. */
    @AuditRedacted
    @Column(name = "indigenous_people")
    private Boolean indigenousPeople;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static Defendant create(UUID caseId, UUID personId, DefendantData data, PersonKind personKind) {
        Defendant defendant = new Defendant();
        defendant.caseId = caseId;
        defendant.personId = personId;
        defendant.createdAt = Instant.now();
        defendant.apply(data, personKind);
        return defendant;
    }

    /** The stage the data asks for, or the first one when it names none. */
    static String stageOf(DefendantData data) {
        String stage = Text.clean(data.stageCode());
        return stage == null ? DEFAULT_STAGE : stage;
    }

    static String closingOutcomeOf(DefendantData data) {
        return Text.clean(data.closingOutcomeCode());
    }

    /**
     * Replaces every editable field. The validation runs before anything is assigned, so a rejected
     * change leaves the defendant untouched.
     */
    void apply(DefendantData data, PersonKind personKind) {
        String stage = stageOf(data);
        DefendantStatus newStatus = data.status() == null ? DefendantStatus.ACTIVE : data.status();
        String outcome = closingOutcomeOf(data);
        boolean closed = newStatus == DefendantStatus.CLOSED;
        if (closed != CLOSED_STAGE.equals(stage)) {
            throw new InvalidCaseDataException("A closed defendant is in the stage '" + CLOSED_STAGE
                    + "', and only a closed defendant is");
        }
        if (closed != (outcome != null)) {
            throw new InvalidCaseDataException("A closed defendant needs a closing outcome, and only a closed one has it");
        }
        requireValidRebellion(data.rebellionDeclaredOn(), data.rebellionLiftedOn());
        if (data.indigenousPeople() != null && personKind != PersonKind.HUMAN) {
            throw new InvalidCaseDataException("Belonging to an indigenous people only applies to a human person");
        }
        boolean byFirm = data.defendedByFirm() == null || data.defendedByFirm();
        CounselKind counselKind = data.defenceCounselKind();
        if (byFirm) {
            if (counselKind == CounselKind.PUBLIC) {
                throw new InvalidCaseDataException("A defendant defended by the firm has a private counsel");
            }
            counselKind = CounselKind.PRIVATE;
        }

        this.stageCode = stage;
        this.status = newStatus;
        this.closingOutcomeCode = outcome;
        this.chargesFormulatedOn = data.chargesFormulatedOn();
        this.defendedByFirm = byFirm;
        this.defenceCounselKind = counselKind;
        this.defenceCounselName = Text.clean(data.defenceCounselName());
        this.rebellionDeclaredOn = data.rebellionDeclaredOn();
        this.rebellionLiftedOn = data.rebellionLiftedOn();
        this.indigenousPeople = data.indigenousPeople();
    }

    private static void requireValidRebellion(LocalDate declared, LocalDate lifted) {
        if (lifted != null && declared == null) {
            throw new InvalidCaseDataException("A rebellion cannot be lifted before it is declared");
        }
        if (lifted != null && lifted.isBefore(declared)) {
            throw new InvalidCaseDataException("The rebellion cannot be lifted before the day it was declared");
        }
    }

    boolean isClosed() {
        return status == DefendantStatus.CLOSED;
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
