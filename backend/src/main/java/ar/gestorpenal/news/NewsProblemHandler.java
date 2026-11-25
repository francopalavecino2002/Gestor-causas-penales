package ar.gestorpenal.news;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for news wall errors. */
@RestControllerAdvice(assignableTypes = NewsController.class)
class NewsProblemHandler {

    @ExceptionHandler(PostNotFoundException.class)
    ProblemDetail notFound(PostNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidPostException.class)
    ProblemDetail invalid(InvalidPostException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-post", "Invalid data", exception.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
