package ar.gestorpenal.person;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/**
 * A human or legal person known to the firm (ADR-0014). Archived, never deleted. It holds no
 * sensitive data on purpose; what a person is in a case (defendant, victim...) comes with cases.
 */
@Entity
@Audited
@Table(name = "person")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class Person extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 10)
    private PersonKind kind;

    @Column(name = "first_names", length = 120)
    private String firstNames;

    @Column(name = "last_names", length = 120)
    private String lastNames;

    @Column(name = "legal_name", length = 200)
    private String legalName;

    @Column(length = 200)
    private String aliases;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", length = 10)
    private DocumentType documentType;

    /** Normalized: uppercase, without spaces, dots or hyphens. */
    @Column(name = "document_number", length = 30)
    private String documentNumber;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(length = 60)
    private String nationality;

    @Column(length = 40)
    private String phone;

    @Column(length = 200)
    private String email;

    /** Domicilio. */
    @Column(length = 300)
    private String address;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static Person create(PersonData data) {
        Person person = new Person();
        person.kind = data.kind();
        person.createdAt = Instant.now();
        person.apply(data);
        return person;
    }

    /** Replaces every editable field. The kind of a person never changes. */
    void apply(PersonData data) {
        requireSameKind(data);
        String first = Text.clean(data.firstNames());
        String last = Text.clean(data.lastNames());
        String legal = Text.clean(data.legalName());
        requireNamesOfKind(first, last, legal, data.birthDate());
        String number = Text.clean(data.documentNumber()) == null ? null : DocumentLookup.normalize(data.documentNumber());
        requireValidDocument(data.documentType(), number);

        this.firstNames = first;
        this.lastNames = last;
        this.legalName = legal;
        this.aliases = Text.clean(data.aliases());
        this.documentType = data.documentType();
        this.documentNumber = number;
        this.birthDate = data.birthDate();
        this.nationality = Text.clean(data.nationality());
        this.phone = Text.clean(data.phone());
        this.email = Text.clean(data.email());
        this.address = Text.clean(data.address());
    }

    void requireSameKind(PersonData data) {
        if (data.kind() != kind) {
            throw new InvalidPersonDataException("The kind of a person cannot change");
        }
    }

    private void requireNamesOfKind(String first, String last, String legal, LocalDate birth) {
        if (kind == PersonKind.HUMAN) {
            if (last == null) {
                throw new InvalidPersonDataException("A human needs last names");
            }
            if (legal != null) {
                throw new InvalidPersonDataException("A human has no legal name");
            }
        } else if (legal == null) {
            throw new InvalidPersonDataException("A legal entity needs a legal name");
        } else if (first != null || last != null || birth != null) {
            throw new InvalidPersonDataException("A legal entity has no first names, last names or birth date");
        }
    }

    private static void requireValidDocument(DocumentType type, String number) {
        if ((type == null) != (number == null)) {
            throw new InvalidPersonDataException("The document type and number go together: send both or neither");
        }
        if (type != null && !type.accepts(number)) {
            throw new InvalidPersonDataException("The document number does not look like a " + type);
        }
    }

    /** Name to show in lists and alerts. */
    String displayName() {
        if (kind == PersonKind.LEGAL) {
            return legalName;
        }
        return firstNames == null ? lastNames : lastNames + ", " + firstNames;
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
