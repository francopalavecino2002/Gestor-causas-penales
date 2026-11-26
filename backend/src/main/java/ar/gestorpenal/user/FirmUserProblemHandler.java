package ar.gestorpenal.user;

import java.net.URI;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for the owner's users screen. */
@RestControllerAdvice(assignableTypes = FirmUserController.class)
class FirmUserProblemHandler {

    private static final String EMAIL_UNIQUE_KEY = "app_user_tenant_email_uk";

    @ExceptionHandler(UserNotFoundException.class)
    ProblemDetail notFound(UserNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidUserDataException.class)
    ProblemDetail invalid(InvalidUserDataException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-user-data", "Invalid data", exception.getMessage());
    }

    @ExceptionHandler(DuplicateEmailException.class)
    ProblemDetail duplicateEmail(DuplicateEmailException exception) {
        return problem(HttpStatus.CONFLICT, "user-duplicate-email", "Email already registered", exception.getMessage());
    }

    @ExceptionHandler(UserManagementException.class)
    ProblemDetail refused(UserManagementException exception) {
        return problem(HttpStatus.CONFLICT, exception.reason().type, "Change refused", exception.getMessage());
    }

    /**
     * Two owners created the same email at once: the unique key keeps one. Any other integrity
     * violation is a bug and is rethrown, so it is not disguised as a duplicate.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentDuplicate(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation
                    && EMAIL_UNIQUE_KEY.equals(violation.getConstraintName())) {
                return duplicateEmail(new DuplicateEmailException());
            }
        }
        throw exception;
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
