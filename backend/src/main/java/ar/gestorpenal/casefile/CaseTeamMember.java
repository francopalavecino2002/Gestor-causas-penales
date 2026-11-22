package ar.gestorpenal.casefile;

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
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A firm member working on a case. A change of role archives the row and adds a new one. */
@Entity
@Audited
@Table(name = "case_team_member")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class CaseTeamMember extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false, updatable = false)
    private UUID caseId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "team_role", nullable = false, updatable = false, length = 20)
    private TeamRole teamRole;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static CaseTeamMember create(UUID caseId, UUID userId, TeamRole teamRole) {
        CaseTeamMember member = new CaseTeamMember();
        member.caseId = caseId;
        member.userId = userId;
        member.teamRole = teamRole;
        member.createdAt = Instant.now();
        return member;
    }

    void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
        }
    }
}
