package ar.gestorpenal.aiassist;

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

/**
 * One request to the AI provider: who, when, for which feature and case, and whether it worked. It is
 * the usage log itself, so it is written once and never changed. The text sent is never stored.
 */
@Entity
@Table(name = "ai_assist_use")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class AiAssistUse extends TenantScopedEntity {

    enum Feature {
        HEARING_FROM_NOTIFICATION
    }

    enum Outcome {
        SUCCEEDED,
        FAILED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 40)
    private Feature feature;

    @Column(name = "case_id", updatable = false)
    private UUID caseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private Outcome outcome;

    @Column(name = "used_at", nullable = false, updatable = false)
    private Instant usedAt;

    static AiAssistUse of(UUID userId, Feature feature, UUID caseId, Outcome outcome, Instant usedAt) {
        AiAssistUse use = new AiAssistUse();
        use.userId = userId;
        use.feature = feature;
        use.caseId = caseId;
        use.outcome = outcome;
        use.usedAt = usedAt;
        return use;
    }
}
