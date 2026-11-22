package ar.gestorpenal.casefile;

import ar.gestorpenal.person.PersonKind;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point the demo data uses to create cases without a logged-in user. It
 * trusts its caller: the codes are those of the jurisdiction package and nobody is checked for access.
 * Call it inside a tenant scope, outside any transaction.
 */
@Service
public class CaseSeeding {

    private final CaseFileRepository cases;
    private final CaseTeamMemberRepository team;
    private final DefendantRepository defendants;
    private final DefendantChargeRepository charges;

    CaseSeeding(
            CaseFileRepository cases,
            CaseTeamMemberRepository team,
            DefendantRepository defendants,
            DefendantChargeRepository charges) {
        this.cases = cases;
        this.team = team;
        this.defendants = defendants;
        this.charges = charges;
    }

    @Transactional(readOnly = true)
    public boolean caseExists(String internalNumber) {
        return cases.findByInternalNumber(internalNumber).isPresent();
    }

    /** A public-action defence case with {@code responsibleUserId} as its responsible lawyer. */
    @Transactional
    public UUID createCase(
            UUID responsibleUserId, String caption, String internalNumber, String circumscriptionCode, boolean reserved) {
        CaseFile caseFile = cases.save(CaseFile.create(new CaseData(
                caption, internalNumber, null, null, null, circumscriptionCode,
                ActionType.PUBLIC, Representation.DEFENCE, reserved, null)));
        team.save(CaseTeamMember.create(caseFile.getId(), responsibleUserId, TeamRole.RESPONSIBLE));
        return caseFile.getId();
    }

    /** An active human defendant in {@code stageCode}, defended by the firm, with one charge. */
    @Transactional
    public void addDefendant(UUID caseId, UUID personId, String stageCode, String offence, String legalReference) {
        DefendantData data = new DefendantData(
                personId, stageCode, DefendantStatus.ACTIVE, null, null, true, null, null, null, null, null);
        Defendant defendant = defendants.save(Defendant.create(caseId, personId, data, PersonKind.HUMAN));
        charges.save(DefendantCharge.create(defendant.getId(), new ChargeData(offence, legalReference)));
    }
}
