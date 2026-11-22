package ar.gestorpenal.casefile;

import ar.gestorpenal.customfield.CustomFieldEntity;
import ar.gestorpenal.customfield.CustomFields;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.person.PersonSummary;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.security.AuthenticatedUser;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Defendants of a case and their charges (ADR-0015). Catalog codes are checked here, and always
 * before the entity is changed: a query would otherwise flush a half-changed entity.
 */
@Service
class DefendantService {

    private final DefendantRepository defendants;
    private final DefendantChargeRepository charges;
    private final CaseAccess access;
    private final CaseCatalogs catalogs;
    private final CaseViews views;
    private final Persons persons;
    private final CustomFields customFields;

    DefendantService(
            DefendantRepository defendants,
            DefendantChargeRepository charges,
            CaseAccess access,
            CaseCatalogs catalogs,
            CaseViews views,
            Persons persons,
            CustomFields customFields) {
        this.defendants = defendants;
        this.charges = charges;
        this.access = access;
        this.catalogs = catalogs;
        this.views = views;
        this.persons = persons;
        this.customFields = customFields;
    }

    @Transactional
    DefendantView add(AuthenticatedUser user, UUID caseId, DefendantData data) {
        CaseFile caseFile = access.requireEditable(user, caseId);
        if (data.personId() == null) {
            throw new InvalidCaseDataException("A defendant needs a person");
        }
        PersonSummary person = persons.find(data.personId())
                .orElseThrow(() -> new CaseRecordNotFoundException("There is no person " + data.personId()));
        if (person.archived()) {
            throw new InvalidCaseDataException("An archived person cannot be added to a case: restore it first");
        }
        if (defendants.existsByCaseIdAndPersonIdAndArchivedAtIsNull(caseId, person.id())) {
            throw new DuplicateRecordException("The person is already a defendant in the case");
        }
        requireCatalogCodes(data, null, null);
        Map<String, Object> values = customFields.resolveNew(CustomFieldEntity.DEFENDANT, data.customFields());
        Defendant defendant = Defendant.create(caseFile.getId(), person.id(), data, person.kind());
        defendant.replaceCustomFields(values);
        return views.defendant(defendants.saveAndFlush(defendant));
    }

    @Transactional
    DefendantView update(AuthenticatedUser user, UUID caseId, UUID defendantId, DefendantData data) {
        access.requireEditable(user, caseId);
        Defendant defendant = findEditable(caseId, defendantId);
        if (data.personId() != null && !data.personId().equals(defendant.getPersonId())) {
            throw new InvalidCaseDataException("The person of a defendant cannot change");
        }
        // A full replace: the defaults are for a new defendant, never to reset an existing one.
        if (data.stageCode() == null || data.status() == null || data.defendedByFirm() == null) {
            throw new InvalidCaseDataException("Updating a defendant needs its stage, status and defendedByFirm");
        }
        PersonSummary person = persons.find(defendant.getPersonId()).orElseThrow();
        requireCatalogCodes(data, defendant.getStageCode(), defendant.getClosingOutcomeCode());
        Map<String, Object> values =
                customFields.resolve(CustomFieldEntity.DEFENDANT, data.customFields(), defendant.getCustomFields());
        defendant.apply(data, person.kind());
        defendant.replaceCustomFields(values);
        return views.defendant(defendant);
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID caseId, UUID defendantId) {
        access.requireVisible(user, caseId);
        find(caseId, defendantId).archive();
    }

    @Transactional
    ChargeView addCharge(AuthenticatedUser user, UUID caseId, UUID defendantId, ChargeData data) {
        access.requireEditable(user, caseId);
        Defendant defendant = findEditable(caseId, defendantId);
        return ChargeView.of(charges.saveAndFlush(DefendantCharge.create(defendant.getId(), data)));
    }

    @Transactional
    ChargeView updateCharge(AuthenticatedUser user, UUID caseId, UUID defendantId, UUID chargeId, ChargeData data) {
        access.requireEditable(user, caseId);
        findEditable(caseId, defendantId);
        DefendantCharge charge = findCharge(caseId, defendantId, chargeId);
        charge.apply(data);
        return ChargeView.of(charge);
    }

    @Transactional
    void archiveCharge(AuthenticatedUser user, UUID caseId, UUID defendantId, UUID chargeId) {
        access.requireVisible(user, caseId);
        findCharge(caseId, defendantId, chargeId).archive();
    }

    private void requireCatalogCodes(DefendantData data, String currentStage, String currentOutcome) {
        catalogs.requireOffered(Catalog.STAGES, Defendant.stageOf(data), currentStage);
        String outcome = Defendant.closingOutcomeOf(data);
        if (outcome != null) {
            catalogs.requireOffered(Catalog.CLOSING_OUTCOMES, outcome, currentOutcome);
        }
    }

    private Defendant find(UUID caseId, UUID defendantId) {
        return defendants.findByIdAndCaseId(defendantId, caseId)
                .orElseThrow(() -> new CaseRecordNotFoundException("The case has no defendant " + defendantId));
    }

    private Defendant findEditable(UUID caseId, UUID defendantId) {
        Defendant defendant = find(caseId, defendantId);
        if (defendant.isArchived()) {
            throw new ArchivedRecordException("The defendant is archived");
        }
        return defendant;
    }

    private DefendantCharge findCharge(UUID caseId, UUID defendantId, UUID chargeId) {
        Defendant defendant = find(caseId, defendantId);
        return charges.findByIdAndDefendantId(chargeId, defendant.getId())
                .orElseThrow(() -> new CaseRecordNotFoundException("The defendant has no charge " + chargeId));
    }
}
