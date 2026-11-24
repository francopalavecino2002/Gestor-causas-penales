package ar.gestorpenal.task;

/** 404: the record does not exist in the firm, or belongs to a reserved case the user cannot see. */
class TaskNotFoundException extends RuntimeException {

    TaskNotFoundException(String message) {
        super(message);
    }
}
