package ar.gestorpenal.person;

import java.util.List;
import java.util.UUID;

/** A person of the firm whose document matches the one being checked, with their roles in cases. */
record DocumentMatch(
        UUID personId,
        String displayName,
        DocumentType documentType,
        String documentNumber,
        boolean archived,
        boolean client,
        List<CaseRole> caseRoles) {}
