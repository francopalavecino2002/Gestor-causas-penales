package ar.gestorpenal.casefile;

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

/** A person with a role in a case (victim, witness, expert...). The defendant is not a party. */
@Entity
@Audited
@Table(name = "case_party")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class CaseParty extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(name = "person_id", nullable = false, updatable = false)
    private UUID personId;

    @Column(name = "role_code", nullable = false, updatable = false, length = 60)
    private String roleCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static CaseParty create(UUID caseId, UUID personId, String roleCode) {
        CaseParty party = new CaseParty();
        party.caseId = caseId;
        party.personId = personId;
        party.roleCode = roleCode;
        party.createdAt = Instant.now();
        return party;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
