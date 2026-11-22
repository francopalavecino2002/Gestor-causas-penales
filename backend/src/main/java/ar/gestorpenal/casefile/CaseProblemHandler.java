package ar.gestorpenal.casefile;

import ar.gestorpenal.customfield.InvalidCustomFieldValueException;
import java.net.URI;
import java.util.Set;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for case, defendant, party and team errors. */
@RestControllerAdvice(assignableTypes = {CaseController.class, DefendantController.class})
class CaseProblemHandler {

    /** Unique keys of V8 that two simultaneous requests can hit. */
    private static final Set<String> UNIQUE_KEYS = Set.of(
            "case_file_internal_number_uk",
            "case_file_mpf_legajo_uk",
            "case_team_member_user_uk",
            "case_team_member_responsible_uk",
            "case_party_uk",
            "defendant_person_uk");

    @ExceptionHandler(CaseRecordNotFoundException.class)
    ProblemDetail notFound(CaseRecordNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidCaseDataException.class)
    ProblemDetail invalid(InvalidCaseDataException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-case-data", "Invalid data", exception.getMessage());
    }

    @ExceptionHandler(InvalidCustomFieldValueException.class)
    ProblemDetail invalidCustomFields(InvalidCustomFieldValueException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-custom-field-value", "Invalid custom field value",
                exception.getMessage());
    }

    @ExceptionHandler(DuplicateCaseNumberException.class)
    ProblemDetail duplicateNumber(DuplicateCaseNumberException exception) {
        ProblemDetail problem = problem(
                HttpStatus.CONFLICT, exception.problemType(), "Case number already registered", exception.getMessage());
        if (exception.existingCaseId() != null) {
            problem.setProperty("existingCaseId", exception.existingCaseId());
        }
        return problem;
    }

    @ExceptionHandler(DuplicateRecordException.class)
    ProblemDetail duplicate(DuplicateRecordException exception) {
        return problem(HttpStatus.CONFLICT, "duplicate-record", "Already in the case", exception.getMessage());
    }

    @ExceptionHandler(ArchivedRecordException.class)
    ProblemDetail archived(ArchivedRecordException exception) {
        return problem(HttpStatus.CONFLICT, "archived-record", "Archived", exception.getMessage());
    }

    /**
     * Two requests changed the same thing at once: the unique key keeps one, the other retries. Any
     * other integrity violation is a bug and is rethrown, so it is not disguised as a race.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentChange(DataIntegrityViolationException exception) {
        if (!violatesUniqueKey(exception)) {
            throw exception;
        }
        return problem(HttpStatus.CONFLICT, "concurrent-change", "Concurrent change",
                "The record was changed at the same time by another request. Reload and try again.");
    }

    static boolean violatesUniqueKey(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                return UNIQUE_KEYS.contains(violation.getConstraintName());
            }
        }
        return false;
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
