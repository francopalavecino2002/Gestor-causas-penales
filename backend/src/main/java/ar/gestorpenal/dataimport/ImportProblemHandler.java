package ar.gestorpenal.dataimport;

import java.net.URI;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for import errors. */
@RestControllerAdvice(assignableTypes = ImportController.class)
class ImportProblemHandler {

    /** PostgreSQL's SQLSTATE for a unique violation. */
    private static final String UNIQUE_VIOLATION = "23505";

    @ExceptionHandler(InvalidImportFileException.class)
    ProblemDetail invalidFile(InvalidImportFileException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "import-invalid-file", "Invalid file", exception.getMessage());
        if (!exception.headers().isEmpty()) {
            problem.setProperty("headers", exception.headers());
        }
        return problem;
    }

    /** A commit with failed rows saved nothing; the report says which rows and why. */
    @ExceptionHandler(ImportHasErrorsException.class)
    ProblemDetail hasErrors(ImportHasErrorsException exception) {
        ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_CONTENT, "import-has-errors",
                "The import has errors", "Some rows have errors, so nothing was saved. Fix them and upload the file again.");
        problem.setProperty("report", exception.report());
        return problem;
    }

    /**
     * Another user saved a record with the same unique key while the import ran: the whole import is
     * aborted and can be retried. Any other integrity violation is a bug and is rethrown.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentChange(DataIntegrityViolationException exception) {
        if (!violatesUniqueKey(exception)) {
            throw exception;
        }
        return problem(HttpStatus.CONFLICT, "concurrent-change", "Concurrent change",
                "A record was changed at the same time by another request. Nothing was saved: upload the file again.");
    }

    private static boolean violatesUniqueKey(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                return UNIQUE_VIOLATION.equals(violation.getSQLState());
            }
        }
        return false;
    }

    static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
