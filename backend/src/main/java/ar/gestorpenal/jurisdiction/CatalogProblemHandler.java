package ar.gestorpenal.jurisdiction;

import java.net.URI;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for catalog errors. */
@RestControllerAdvice(assignableTypes = CatalogController.class)
class CatalogProblemHandler {

    @ExceptionHandler(CatalogItemNotFoundException.class)
    ProblemDetail notFound(CatalogItemNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "catalog-item-not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(CatalogChangeNotAllowedException.class)
    ProblemDetail notAllowed(CatalogChangeNotAllowedException exception) {
        return problem(HttpStatus.CONFLICT, "catalog-change-not-allowed", "Change not allowed", exception.getMessage());
    }

    @ExceptionHandler(InvalidCatalogChangeException.class)
    ProblemDetail invalid(InvalidCatalogChangeException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-catalog-change", "Invalid change", exception.getMessage());
    }

    /** Two first changes of the same item at once: the unique key keeps one, the other retries. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentChange() {
        return problem(HttpStatus.CONFLICT, "catalog-concurrent-change", "Concurrent change",
                "The item was changed at the same time by another request. Reload and try again.");
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
