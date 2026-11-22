package ar.gestorpenal.deadline;

import java.util.List;

/** A deadline package that cannot be trusted: the application refuses to start with it. */
class InvalidDeadlinePackageException extends RuntimeException {

    InvalidDeadlinePackageException(String location, List<String> problems) {
        super("Invalid deadline package " + location + ":\n - " + String.join("\n - ", problems));
    }

    InvalidDeadlinePackageException(String location, String problem, Throwable cause) {
        super("Invalid deadline package " + location + ": " + problem, cause);
    }
}
