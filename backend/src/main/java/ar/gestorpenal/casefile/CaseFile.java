package ar.gestorpenal.casefile;

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
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A case file, the legajo (ADR-0015). It holds what is common to the case; the stage, status and
 * outcome belong to each {@link Defendant}. Archived, never deleted.
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

    @Column(name = "circumscription_code", nullable = false, length = 60)
    private String circumscriptionCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 30)
    private ActionType actionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Representation represents;

    @Column(nullable = false)
    private boolean reserved;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static CaseFile create(CaseData data) {
        CaseFile caseFile = new CaseFile();
        caseFile.createdAt = Instant.now();
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
        String legajo = MpfLegajo.normalize(data.mpfLegajo());

        this.caption = caption;
        this.internalNumber = Text.clean(data.internalNumber());
        this.mpfLegajo = legajo;
        this.ofijuNumber = Text.clean(data.ofijuNumber());
        this.pehuenNumber = Text.clean(data.pehuenNumber());
        this.circumscriptionCode = circumscription;
        this.actionType = data.actionType();
        this.represents = data.represents();
        this.reserved = data.isReservedCase();
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
