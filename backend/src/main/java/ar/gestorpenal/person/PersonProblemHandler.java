package ar.gestorpenal.person;

import java.net.URI;
import java.util.Set;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for person, client and contact errors. */
@RestControllerAdvice(assignableTypes = {PersonController.class, ClientController.class})
class PersonProblemHandler {

    /** Unique keys of V7 that two simultaneous requests can hit. */
    private static final Set<String> UNIQUE_KEYS = Set.of("person_document_uk", "client_person_uk");

    @ExceptionHandler(RecordNotFoundException.class)
    ProblemDetail notFound(RecordNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidPersonDataException.class)
    ProblemDetail invalid(InvalidPersonDataException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-person-data", "Invalid data", exception.getMessage());
    }

    @ExceptionHandler(DuplicateDocumentException.class)
    ProblemDetail duplicateDocument(DuplicateDocumentException exception) {
        ProblemDetail problem = problem(
                HttpStatus.CONFLICT, "person-duplicate-document", "Document already registered", exception.getMessage());
        problem.setProperty("existingPersonId", exception.existingPersonId());
        return problem;
    }

    @ExceptionHandler(AlreadyAClientException.class)
    ProblemDetail alreadyAClient(AlreadyAClientException exception) {
        ProblemDetail problem = problem(HttpStatus.CONFLICT, "already-a-client", "Already a client", exception.getMessage());
        problem.setProperty("clientId", exception.clientId());
        return problem;
    }

    /**
     * Two requests created the same record at once: the unique key keeps one, the other retries.
     * Any other integrity violation is a bug and is rethrown, so it is not disguised as a race.
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
