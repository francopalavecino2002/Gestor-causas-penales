package ar.gestorpenal.person;

import java.util.UUID;

/** Another person of the firm already has this document (answered as 409). */
class DuplicateDocumentException extends RuntimeException {

    private final UUID existingPersonId;

    DuplicateDocumentException(UUID existingPersonId) {
        super("A person with this document is already registered");
        this.existingPersonId = existingPersonId;
    }

    UUID existingPersonId() {
        return existingPersonId;
    }
}
