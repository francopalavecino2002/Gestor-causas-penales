package ar.gestorpenal.deadline;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** The only two things a firm can change on a built-in rule. */
record RuleSettingData(
        @NotNull Boolean enabled,
        @NotNull @Min(0) @Max(DeadlinePackageLoader.MAX_ALERT_DAYS) Integer alertDaysBefore) {}
