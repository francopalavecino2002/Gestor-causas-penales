package ar.gestorpenal.deadline;

import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantService;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The rules of the current firm: its jurisdiction's package per practice area plus the firm's settings (ADR-0017). */
@Component
class FirmRules {

    private final DeadlinePackages packages;
    private final TenantService tenants;
    private final DeadlineRuleSettingRepository settings;

    FirmRules(DeadlinePackages packages, TenantService tenants, DeadlineRuleSettingRepository settings) {
        this.packages = packages;
        this.tenants = tenants;
        this.settings = settings;
    }

    /** The package and the firm's settings, read together once per request. */
    record Snapshot(DeadlinePackage deadlinePackage, Map<String, DeadlineRuleSetting> settings) {

        DeadlineRule rule(String code) {
            return deadlinePackage.rule(code)
                    .orElseThrow(() -> new IllegalStateException("The package has no rule " + code));
        }

        boolean enabled(DeadlineRule rule) {
            DeadlineRuleSetting setting = settings.get(rule.code());
            return setting == null || setting.isEnabled();
        }

        int alertDaysBefore(DeadlineRule rule) {
            DeadlineRuleSetting setting = settings.get(rule.code());
            return setting == null ? rule.alertDaysBefore() : setting.getAlertDaysBefore();
        }
    }

    /** The penal rules and the firm's settings (the other areas ship no rules yet, ADR-0032). */
    @Transactional(readOnly = true)
    Snapshot current() {
        return current(Tenant.DEFAULT_PRACTICE_AREA);
    }

    @Transactional(readOnly = true)
    Snapshot current(String areaCode) {
        return new Snapshot(
                currentPackage(areaCode),
                settings.findAll().stream()
                        .collect(Collectors.toMap(DeadlineRuleSetting::getRuleCode, Function.identity())));
    }

    DeadlinePackage currentPackage() {
        return currentPackage(Tenant.DEFAULT_PRACTICE_AREA);
    }

    DeadlinePackage currentPackage(String areaCode) {
        return packages.get(tenants.currentJurisdictionCode(), areaCode);
    }
}
