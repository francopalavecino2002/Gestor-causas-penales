package ar.gestorpenal.customfield;

/** A change to a custom field definition that breaks its rules (answered as 400). */
class InvalidCustomFieldDefinitionException extends RuntimeException {

    InvalidCustomFieldDefinitionException(String message) {
        super(message);
    }
}
