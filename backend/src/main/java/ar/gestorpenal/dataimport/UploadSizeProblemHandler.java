package ar.gestorpenal.dataimport;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * The servlet limit of a multipart request fails before any controller is chosen, so this advice
 * cannot be limited to {@link ImportController}. Imports are the only endpoint that takes files.
 */
@RestControllerAdvice
class UploadSizeProblemHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ProblemDetail tooLarge() {
        return ImportProblemHandler.problem(HttpStatus.BAD_REQUEST, "import-invalid-file", "Invalid file",
                "El archivo pesa más de 2 MB.");
    }
}
