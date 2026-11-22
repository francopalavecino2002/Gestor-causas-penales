package ar.gestorpenal.person;

import java.util.UUID;

/** The person already has a client record, archived or not (answered as 409). */
class AlreadyAClientException extends RuntimeException {

    private final UUID clientId;

    AlreadyAClientException(UUID clientId) {
        super("The person is already a client");
        this.clientId = clientId;
    }

    UUID clientId() {
        return clientId;
    }
}
