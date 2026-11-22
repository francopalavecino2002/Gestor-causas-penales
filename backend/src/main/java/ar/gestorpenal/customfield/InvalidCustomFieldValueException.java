package ar.gestorpenal.customfield;

/**
 * A record was sent with custom field values that do not fit the firm's definitions (unknown field,
 * wrong type, missing required value). Answered as 400 by the controllers of the records.
 */
public class InvalidCustomFieldValueException extends RuntimeException {

    InvalidCustomFieldValueException(String message) {
        super(message);
    }
}
