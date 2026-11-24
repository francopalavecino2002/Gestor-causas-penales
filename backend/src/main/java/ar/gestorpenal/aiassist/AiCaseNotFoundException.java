package ar.gestorpenal.aiassist;

/** The case does not exist, or it is a reserved case the user cannot see. */
class AiCaseNotFoundException extends RuntimeException {

    AiCaseNotFoundException() {
        super("There is no such case");
    }
}
