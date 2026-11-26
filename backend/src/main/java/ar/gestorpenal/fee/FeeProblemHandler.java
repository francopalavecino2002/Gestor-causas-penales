package ar.gestorpenal.fee;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for fees errors. */
@RestControllerAdvice(assignableTypes = FeeController.class)
class FeeProblemHandler {

    @ExceptionHandler(FeeNotFoundException.class)
    ProblemDetail notFound(FeeNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    /** Names the offending request field in the {@code field} property. */
    @ExceptionHandler(InvalidFeeDataException.class)
    ProblemDetail invalid(InvalidFeeDataException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "invalid-fee-data", "Invalid data", exception.getMessage());
        problem.setProperty("field", exception.field());
        return problem;
    }

    @ExceptionHandler(JusValueMissingException.class)
    ProblemDetail missingJusValue(JusValueMissingException exception) {
        return problem(HttpStatus.CONFLICT, "jus-value-missing", JusValueMissingException.MESSAGE, exception.getMessage());
    }

    @ExceptionHandler(DuplicateJusValueException.class)
    ProblemDetail duplicate(DuplicateJusValueException exception) {
        return problem(HttpStatus.CONFLICT, "duplicate-jus-value", "Duplicate", exception.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
