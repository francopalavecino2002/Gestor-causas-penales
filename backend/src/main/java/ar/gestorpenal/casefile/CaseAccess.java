package ar.gestorpenal.casefile;

import ar.gestorpenal.security.AuthenticatedUser;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Loads a case for a user, answering "not found" when it does not exist in their firm or is reserved
 * and not theirs to see. Every endpoint under {@code /cases/{id}} goes through here.
 */
@Component
class CaseAccess {

    private final CaseFileRepository cases;
    private final CaseTeamMemberRepository team;

    CaseAccess(CaseFileRepository cases, CaseTeamMemberRepository team) {
        this.cases = cases;
        this.team = team;
    }

    CaseFile requireVisible(AuthenticatedUser user, UUID caseId) {
        return cases.findById(caseId)
                .filter(caseFile -> canSee(user, caseFile))
                .orElseThrow(() -> new CaseRecordNotFoundException("There is no case " + caseId));
    }

    /** A visible case that is not archived: an archived case is read-only until it is restored. */
    CaseFile requireEditable(AuthenticatedUser user, UUID caseId) {
        CaseFile caseFile = requireVisible(user, caseId);
        if (caseFile.isArchived()) {
            throw new ArchivedRecordException("The case is archived: restore it before changing it");
        }
        return caseFile;
    }

    boolean canSee(AuthenticatedUser user, CaseFile caseFile) {
        return CasePermissions.canSeeWithoutTeam(user, caseFile.isReserved())
                || team.existsByCaseIdAndUserIdAndArchivedAtIsNull(caseFile.getId(), user.userId());
    }
}
