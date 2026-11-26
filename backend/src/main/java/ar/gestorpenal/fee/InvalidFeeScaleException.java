package ar.gestorpenal.fee;

import java.util.List;

/** A fees scale that cannot be trusted: the application refuses to start with it. */
class InvalidFeeScaleException extends RuntimeException {

    InvalidFeeScaleException(String location, List<String> problems) {
        super("Invalid fees scale " + location + ":\n - " + String.join("\n - ", problems));
    }

    InvalidFeeScaleException(String location, String problem, Throwable cause) {
        super("Invalid fees scale " + location + ": " + problem, cause);
    }
}
