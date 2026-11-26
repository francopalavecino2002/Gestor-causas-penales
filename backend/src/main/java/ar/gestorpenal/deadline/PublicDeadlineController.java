package ar.gestorpenal.deadline;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The public deadline calculator (ADR-0041): no login, read only, rate-limited per client address.
 * Both endpoints are GET because they only compute: nothing is stored and no CSRF token is needed.
 */
@RestController
@RequestMapping("/api/v1/public")
class PublicDeadlineController {

    private final PublicDeadlineCalculator calculator;
    private final PublicCalculatorThrottle throttle;

    PublicDeadlineController(PublicDeadlineCalculator calculator, PublicCalculatorThrottle throttle) {
        this.calculator = calculator;
        this.throttle = throttle;
    }

    @GetMapping("/deadline-rules")
    List<PublicRuleView> rules(HttpServletRequest request) {
        throttle.acquire(request.getRemoteAddr());
        return calculator.rules();
    }

    /** {@code startTime} (HH:mm, Neuquén time) only for terms in hours. */
    @GetMapping("/deadline-calculation")
    PublicCalculationView calculate(
            HttpServletRequest request,
            @RequestParam String rule,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "HH:mm") LocalTime startTime) {
        throttle.acquire(request.getRemoteAddr());
        return calculator.calculate(rule, startDate, startTime);
    }
}
