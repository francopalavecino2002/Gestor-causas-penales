package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.security.AuthenticatedUser;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The parties of a case: people with a role other than imputado (defendants have their own table). */
@Service
class CasePartyService {

    static final String DEFENDANT_ROLE = "imputado";

    private final CasePartyRepository parties;
    private final CaseAccess access;
    private final CaseCatalogs catalogs;
    private final CaseViews views;
    private final Persons persons;

    CasePartyService(
            CasePartyRepository parties, CaseAccess access, CaseCatalogs catalogs, CaseViews views, Persons persons) {
        this.parties = parties;
        this.access = access;
        this.catalogs = catalogs;
        this.views = views;
        this.persons = persons;
    }

    @Transactional
    PartyView add(AuthenticatedUser user, UUID caseId, PartyData data) {
        CaseFile caseFile = access.requireEditable(user, caseId);
        String role = Text.clean(data.roleCode());
        if (role == null) {
            throw new InvalidCaseDataException("A party needs a role");
        }
        if (DEFENDANT_ROLE.equals(role)) {
            throw new InvalidCaseDataException("A defendant is not a party: use the defendants endpoint");
        }
        catalogs.requireOffered(caseFile.getPracticeArea(), Catalog.PARTY_ROLES, role, null);
        boolean archivedPerson = persons.find(data.personId())
                .orElseThrow(() -> new CaseRecordNotFoundException("There is no person " + data.personId()))
                .archived();
        if (archivedPerson) {
            throw new InvalidCaseDataException("An archived person cannot be added to a case: restore it first");
        }
        if (parties.existsByCaseIdAndPersonIdAndRoleCodeAndArchivedAtIsNull(caseId, data.personId(), role)) {
            throw new DuplicateRecordException("The person already has this role in the case");
        }
        return views.party(
                caseFile.getPracticeArea(), parties.saveAndFlush(CaseParty.create(caseFile.getId(), data.personId(), role)));
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID caseId, UUID partyId) {
        access.requireVisible(user, caseId);
        parties.findByIdAndCaseId(partyId, caseId)
                .orElseThrow(() -> new CaseRecordNotFoundException("The case has no party " + partyId))
                .archive();
    }
}
