package ar.gestorpenal.hearing;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** problem+json bodies (RFC 9457) for hearing, agenda and coercive measure errors. */
@RestControllerAdvice(assignableTypes = {HearingController.class, AgendaController.class, CoerciveMeasureController.class})
class HearingProblemHandler {

    @ExceptionHandler(HearingNotFoundException.class)
    ProblemDetail notFound(HearingNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "not-found", "Not found", exception.getMessage());
    }

    @ExceptionHandler(InvalidHearingDataException.class)
    ProblemDetail invalid(InvalidHearingDataException exception) {
        return problem(HttpStatus.BAD_REQUEST, "invalid-hearing-data", "Invalid data", exception.getMessage());
    }

    @ExceptionHandler(ArchivedHearingRecordException.class)
    ProblemDetail archived(ArchivedHearingRecordException exception) {
        return problem(HttpStatus.CONFLICT, "archived-record", "Archived", exception.getMessage());
    }

    @ExceptionHandler(HearingStateException.class)
    ProblemDetail state(HearingStateException exception) {
        return problem(HttpStatus.CONFLICT, "invalid-hearing-state", "Not allowed in this state", exception.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String type, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create("/problems/" + type));
        problem.setTitle(title);
        return problem;
    }
}
