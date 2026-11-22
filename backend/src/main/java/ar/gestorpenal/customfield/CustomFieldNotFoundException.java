package ar.gestorpenal.customfield;

/** The definition does not exist in the current firm (a missing id and another firm's id look the same). */
class CustomFieldNotFoundException extends RuntimeException {

    CustomFieldNotFoundException(String message) {
        super(message);
    }
}
