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
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Someone a client authorizes the firm to talk to, and what the firm may tell them (ADR-0014).
 * A plain row of the client, not a person. Archived, never deleted.
 */
@Entity
@Audited
@Table(name = "authorized_contact")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class AuthorizedContact extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "client_id", nullable = false, updatable = false)
    private UUID clientId;

    @Column(name = "full_name", nullable = false, length = 200)
    private String fullName;

    /** Vínculo with the client. */
    @Column(length = 80)
    private String relationship;

    @Column(length = 40)
    private String phone;

    @Column(length = 200)
    private String email;

    /** What the firm can tell this contact about the client's matters. */
    @Column(name = "may_be_told", nullable = false, length = 300)
    private String mayBeTold;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static AuthorizedContact create(UUID clientId, ContactData data) {
        AuthorizedContact contact = new AuthorizedContact();
        contact.clientId = clientId;
        contact.createdAt = Instant.now();
        contact.apply(data);
        return contact;
    }

    void apply(ContactData data) {
        this.fullName = Text.clean(data.fullName());
        this.mayBeTold = Text.clean(data.mayBeTold());
        if (fullName == null || mayBeTold == null) {
            throw new InvalidPersonDataException("A contact needs a name and what the firm may tell them");
        }
        this.relationship = Text.clean(data.relationship());
        this.phone = Text.clean(data.phone());
        this.email = Text.clean(data.email());
    }

    boolean isArchived() {
        return archivedAt != null;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
