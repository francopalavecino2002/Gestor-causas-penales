package ar.gestorpenal.person;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * A client with the person behind it, their active authorized contacts and the other people of the
 * firm who share the person's document ({@code conflicts}, the person itself excluded).
 */
record ClientView(
        UUID id,
        PersonView person,
        LocalDate intakeDate,
        String referralSource,
        LocalDate consentGivenOn,
        String consentScope,
        String consentDocumentRef,
        boolean archived,
        Instant createdAt,
        List<ContactView> contacts,
        List<DocumentMatch> conflicts) {

    static ClientView of(Client client, Person person, List<AuthorizedContact> contacts, List<DocumentMatch> conflicts) {
        return new ClientView(
                client.getId(),
                PersonView.of(person),
                client.getIntakeDate(),
                client.getReferralSource(),
                client.getConsentGivenOn(),
                client.getConsentScope(),
                client.getConsentDocumentRef(),
                client.isArchived(),
                client.getCreatedAt(),
                contacts.stream().map(ContactView::of).toList(),
                conflicts);
    }
}
