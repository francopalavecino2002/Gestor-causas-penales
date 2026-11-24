package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The practice areas the current firm works in, with their modules, and the owner's choice of them
 * among the areas of the firm's jurisdiction package (ADR-0032).
 */
@RestController
@RequestMapping("/api/v1/practice-areas")
class PracticeAreaController {

    private final PracticeAreas areas;
    private final PracticeAreaSettings settings;

    PracticeAreaController(PracticeAreas areas, PracticeAreaSettings settings) {
        this.areas = areas;
        this.settings = settings;
    }

    /** The codes of the areas to turn on; every other area of the package is turned off. */
    record EnabledAreasRequest(
            @NotNull @Size(min = 1, max = 20) List<@NotBlank @Size(max = 50) String> codes) {}

    @GetMapping
    List<PracticeAreaView> enabled() {
        return areas.enabled();
    }

    /** Every area of the jurisdiction package, with whether the firm has it on. */
    @GetMapping("/available")
    List<PracticeAreaOption> available() {
        return settings.available();
    }

    @PutMapping("/enabled")
    List<PracticeAreaOption> replaceEnabled(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody EnabledAreasRequest body) {
        return settings.replaceEnabled(user, body.codes());
    }
}
