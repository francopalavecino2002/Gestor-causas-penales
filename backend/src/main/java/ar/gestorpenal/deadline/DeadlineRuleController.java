package ar.gestorpenal.deadline;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The built-in deadline rules and the court calendar of the firm's jurisdiction (ADR-0017). */
@RestController
@RequestMapping("/api/v1")
class DeadlineRuleController {

    private final DeadlineRuleService rules;
    private final DeadlineClock clock;

    DeadlineRuleController(DeadlineRuleService rules, DeadlineClock clock) {
        this.rules = rules;
        this.clock = clock;
    }

    @GetMapping("/deadline-rules")
    List<DeadlineRuleView> all() {
        return rules.rules();
    }

    /** Only whether the rule is enabled and its warning can change; the computation cannot. */
    @PutMapping("/deadline-rules/{code}/settings")
    DeadlineRuleView changeSetting(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String code,
            @Valid @RequestBody RuleSettingData body) {
        return rules.changeSetting(user, code, body);
    }

    /** {@code year} defaults to the current year in the firm's zone. */
    @GetMapping("/court-calendar")
    CourtCalendarView courtCalendar(@RequestParam(required = false) Integer year) {
        return rules.courtCalendar(year == null ? clock.today().getYear() : year);
    }
}
