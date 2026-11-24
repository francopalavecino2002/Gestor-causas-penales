package ar.gestorpenal.calendarfeed;

import java.net.URI;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for the calendar feed. */
@RestControllerAdvice(assignableTypes = CalendarFeedController.class)
class CalendarFeedProblemHandler {

    /** Two simultaneous "new link" requests of the same member: the one live link rule rejects one. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail concurrentIssue(DataIntegrityViolationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT, "Another link was created at the same time: try again");
        problem.setType(URI.create("/problems/calendar-feed-conflict"));
        problem.setTitle("Conflict");
        return problem;
    }
}
