package ar.gestorpenal.customfield;

import java.net.URI;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for custom field errors. */
@RestControllerAdvice(assignableTypes = CustomFieldController.class)
class CustomFieldProblemHandler {

    static final String KEY_UNIQUE_INDEX = "custom_field_definition_key_uk";

    @ExceptionHandler(CustomFieldNotFoundException.class)
    ProblemDetail notFound(CustomFieldNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "custom-field-not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidCustomFieldDefinitionException.class)
    ProblemDetail invalid(InvalidCustomFieldDefinitionException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-custom-field", "Invalid custom field", exception.getMessage());
    }

    /**
     * Two fields with the same label created at once: the unique key keeps one, the other retries.
     * Any other integrity violation is a bug and is rethrown, so it is not disguised as a race.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentChange(DataIntegrityViolationException exception) {
        if (!violatesKeyIndex(exception)) {
            throw exception;
        }
        return problem(HttpStatus.CONFLICT, "custom-field-concurrent-change", "Concurrent change",
                "The field was changed at the same time by another request. Reload and try again.");
    }

    static boolean violatesKeyIndex(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                return KEY_UNIQUE_INDEX.equals(violation.getConstraintName());
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
