package ar.gestorpenal.casefile;

import java.util.UUID;

/**
 * Another case of the firm already has this number (answered as 409). {@code existingCaseId} is
 * {@code null} when that case is reserved and the user cannot see it: the id must not leak.
 */
class DuplicateCaseNumberException extends RuntimeException {

    /** Which number is duplicated; it becomes the problem type. */
    enum Kind {
        MPF_LEGAJO("case-duplicate-legajo", "A case with this MPF legajo is already registered"),
        INTERNAL_NUMBER("case-duplicate-internal-number", "A case with this internal number is already registered");

        private final String problemType;
        private final String message;

        Kind(String problemType, String message) {
            this.problemType = problemType;
            this.message = message;
        }
    }

    private final Kind kind;
    private final UUID existingCaseId;

    DuplicateCaseNumberException(Kind kind, UUID existingCaseId) {
        super(kind.message);
        this.kind = kind;
        this.existingCaseId = existingCaseId;
    }

    Kind kind() {
        return kind;
    }

    String problemType() {
        return kind.problemType;
    }

    UUID existingCaseId() {
        return existingCaseId;
    }
}
