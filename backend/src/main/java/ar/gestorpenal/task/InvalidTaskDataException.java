package ar.gestorpenal.task;

/** 400: the data is well formed but breaks a rule of tasks. */
class InvalidTaskDataException extends RuntimeException {

    InvalidTaskDataException(String message) {
        super(message);
    }
}
