package ar.gestorpenal.casefile;

import ar.gestorpenal.person.PersonKind;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
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

    @Transactional(readOnly = true)
    public Optional<UUID> findCaseId(String internalNumber) {
        return cases.findByInternalNumber(internalNumber).map(CaseFile::getId);
    }

    /** The ids of the case's active defendants, in the order they were added. */
    @Transactional(readOnly = true)
    public List<UUID> defendantIds(UUID caseId) {
        return defendants.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId).stream()
                .map(Defendant::getId)
                .toList();
    }

    /** A public-action defence case with {@code responsibleUserId} as its responsible lawyer. */
    @Transactional
    public UUID createCase(
            UUID responsibleUserId, String caption, String internalNumber, String circumscriptionCode, boolean reserved) {
        CaseFile caseFile = cases.save(CaseFile.create(new CaseData(
                caption, internalNumber, null, null, null, circumscriptionCode,
                ActionType.PUBLIC, Representation.DEFENCE, reserved, null, null, null)));
        team.save(CaseTeamMember.create(caseFile.getId(), responsibleUserId, TeamRole.RESPONSIBLE));
        return caseFile.getId();
    }

    /** An active human defendant in {@code stageCode}, defended by the firm, with one charge. */
    @Transactional
    public void addDefendant(UUID caseId, UUID personId, String stageCode, String offence, String legalReference) {
        addDefendant(caseId, new DefendantSeed(
                personId, stageCode, DefendantStatus.ACTIVE, null, offence, legalReference, null, null));
    }

    /** A human defendant defended by the firm, with one charge; the entity validates stage, status and outcome. */
    @Transactional
    public void addDefendant(UUID caseId, DefendantSeed seed) {
        DefendantData data = new DefendantData(
                seed.personId(), seed.stageCode(), seed.status(), seed.closingOutcomeCode(),
                seed.chargesFormulatedOn(), true, null, null, null, null, seed.indigenousPeople(), null);
        Defendant defendant = defendants.save(Defendant.create(caseId, seed.personId(), data, PersonKind.HUMAN));
        charges.save(DefendantCharge.create(defendant.getId(), new ChargeData(seed.offence(), seed.legalReference())));
    }

    /**
     * A defendant of the demo data. {@code closingOutcomeCode} only for a closed one (stage {@code cerrada});
     * {@code indigenousPeople} is the optional {@code [validar]} field (ADR-0014).
     */
    public record DefendantSeed(
            UUID personId,
            String stageCode,
            DefendantStatus status,
            String closingOutcomeCode,
            String offence,
            String legalReference,
            LocalDate chargesFormulatedOn,
            Boolean indigenousPeople) {}
}
