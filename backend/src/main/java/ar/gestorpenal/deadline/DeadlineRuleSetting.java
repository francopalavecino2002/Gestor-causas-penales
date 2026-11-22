package ar.gestorpenal.deadline;

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
 * What a firm changed on a built-in rule (ADR-0017): whether it is enabled and how many days ahead
 * it warns. The computation itself is never stored here: it cannot be edited.
 */
@Entity
@Audited
@Table(name = "deadline_rule_setting")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class DeadlineRuleSetting extends TenantScopedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "rule_code", nullable = false, updatable = false, length = 60)
    private String ruleCode;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "alert_days_before", nullable = false)
    private int alertDaysBefore;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    static DeadlineRuleSetting create(String ruleCode, boolean enabled, int alertDaysBefore) {
        DeadlineRuleSetting setting = new DeadlineRuleSetting();
        setting.ruleCode = ruleCode;
        setting.createdAt = Instant.now();
        setting.change(enabled, alertDaysBefore);
        return setting;
    }

    void change(boolean enabled, int alertDaysBefore) {
        this.enabled = enabled;
        this.alertDaysBefore = alertDaysBefore;
    }
}
