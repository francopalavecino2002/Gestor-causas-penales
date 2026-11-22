package ar.gestorpenal.deadline;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The firm's view of the built-in rules and its two settings per rule (ADR-0017). Every member reads
 * them; only the owner changes them, because a change applies to the whole firm (as for catalogs).
 */
@Service
class DeadlineRuleService {

    static final int FIRST_CALENDAR_YEAR = 2000;
    static final int LAST_CALENDAR_YEAR = 2100;

    private final FirmRules firmRules;
    private final DeadlineRuleSettingRepository settings;

    DeadlineRuleService(FirmRules firmRules, DeadlineRuleSettingRepository settings) {
        this.firmRules = firmRules;
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    List<DeadlineRuleView> rules() {
        FirmRules.Snapshot firm = firmRules.current();
        return firm.deadlinePackage().rules().stream().map(rule -> DeadlineRuleView.of(rule, firm)).toList();
    }

    @Transactional
    DeadlineRuleView changeSetting(AuthenticatedUser user, String code, RuleSettingData data) {
        if (user.role() != Role.OWNER) {
            throw new AccessDeniedException("Only the firm owner can change deadline rules");
        }
        DeadlineRule rule = firmRules.currentPackage().rule(code)
                .orElseThrow(() -> new DeadlineNotFoundException("There is no deadline rule " + code));
        settings.findByRuleCode(code).ifPresentOrElse(
                setting -> setting.change(data.enabled(), data.alertDaysBefore()),
                () -> settings.save(DeadlineRuleSetting.create(code, data.enabled(), data.alertDaysBefore())));
        settings.flush();
        return DeadlineRuleView.of(rule, firmRules.current());
    }

    @Transactional(readOnly = true)
    CourtCalendarView courtCalendar(int year) {
        if (year < FIRST_CALENDAR_YEAR || year > LAST_CALENDAR_YEAR) {
            throw new InvalidDeadlineDataException(
                    "year must be between " + FIRST_CALENDAR_YEAR + " and " + LAST_CALENDAR_YEAR);
        }
        CourtCalendar calendar = firmRules.currentPackage().calendar();
        return new CourtCalendarView(
                year, calendar.covers(year), calendar.source(), calendar.flags(), calendar.nonBusinessDays(year));
    }
}
