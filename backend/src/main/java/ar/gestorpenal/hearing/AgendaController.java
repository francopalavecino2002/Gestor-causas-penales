package ar.gestorpenal.hearing;

import ar.gestorpenal.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The hearing agenda and the assisted alerts about detainees (ADR-0016). */
@RestController
@RequestMapping("/api/v1")
class AgendaController {

    private final AgendaService agenda;
    private final DetaineeAlertService alerts;

    AgendaController(AgendaService agenda, DetaineeAlertService alerts) {
        this.agenda = agenda;
        this.alerts = alerts;
    }

    /** Local days in the firm's zone, {@code to} inclusive, at most 31 days. */
    @GetMapping("/agenda")
    AgendaView agenda(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID lawyerId) {
        return agenda.agenda(user, from, to, lawyerId);
    }

    @GetMapping("/detainee-alerts")
    List<DetaineeAlertView> detaineeAlerts(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "" + DetaineeAlertService.DEFAULT_WITHIN_DAYS) int withinDays) {
        return alerts.alerts(user, withinDays);
    }
}
