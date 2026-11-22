package ar.gestorpenal.person;

import java.util.UUID;

/** An authorized contact as shown by the API. */
record ContactView(
        UUID id,
        String fullName,
        String relationship,
        String phone,
        String email,
        String mayBeTold,
        boolean archived) {

    static ContactView of(AuthorizedContact contact) {
        return new ContactView(
                contact.getId(),
                contact.getFullName(),
                contact.getRelationship(),
                contact.getPhone(),
                contact.getEmail(),
                contact.getMayBeTold(),
                contact.isArchived());
    }
}
