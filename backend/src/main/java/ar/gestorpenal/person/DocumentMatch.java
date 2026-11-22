package ar.gestorpenal.person;

import java.util.UUID;

/** A person of the firm whose document matches the one being checked. */
record DocumentMatch(
        UUID personId,
        String displayName,
        DocumentType documentType,
        String documentNumber,
        boolean archived,
        boolean client) {}
