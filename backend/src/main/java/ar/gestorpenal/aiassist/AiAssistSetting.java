package ar.gestorpenal.aiassist;

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

/** Whether the firm turned on the optional AI assistance (ADR-0033). No row means it is off. */
@Entity
@Audited
@Table(name = "ai_assist_setting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class AiAssistSetting extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    static AiAssistSetting create(boolean enabled, Instant now) {
        AiAssistSetting setting = new AiAssistSetting();
        setting.enabled = enabled;
        setting.createdAt = now;
        return setting;
    }

    void change(boolean enabled) {
        this.enabled = enabled;
    }
}
