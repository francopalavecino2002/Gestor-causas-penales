package ar.gestorpenal.person;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** The firm's relationship with a person who hired it (ADR-0014). Archived, never deleted. */
@Entity
@Audited
@Table(name = "client")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Client extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "person_id", nullable = false, updatable = false)
    private UUID personId;

    /** Fecha de alta. */
    @Column(name = "intake_date", nullable = false)
    private LocalDate intakeDate;

    /** How the client reached the firm. */
    @Column(name = "referral_source", length = 200)
    private String referralSource;

    @Column(name = "consent_given_on")
    private LocalDate consentGivenOn;

    @Column(name = "consent_scope", length = 500)
    private String consentScope;

    /** Reference to the signed consent form; storing the file comes later. */
    @Column(name = "consent_document_ref", length = 200)
    private String consentDocumentRef;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static Client create(UUID personId, ClientData data) {
        Client client = new Client();
        client.personId = personId;
        client.createdAt = Instant.now();
        client.apply(data);
        return client;
    }

    void apply(ClientData data) {
        String scope = Text.clean(data.consentScope());
        if ((data.consentGivenOn() == null) != (scope == null)) {
            throw new InvalidPersonDataException("The consent date and scope go together: send both or neither");
        }
        this.intakeDate = data.intakeDate();
        this.referralSource = Text.clean(data.referralSource());
        this.consentGivenOn = data.consentGivenOn();
        this.consentScope = scope;
        this.consentDocumentRef = Text.clean(data.consentDocumentRef());
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }

    void restore() {
        archivedAt = null;
    }
}
