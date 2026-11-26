package ar.gestorpenal.fee;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Fees in JUS (ADR-0040): the scale, the firm's JUS values and the stateless calculator. */
@RestController
@RequestMapping("/api/v1/fees")
class FeeController {

    private final FeeService fees;
    private final JusValueService jusValues;

    FeeController(FeeService fees, JusValueService jusValues) {
        this.fees = fees;
        this.jusValues = jusValues;
    }

    /** The rules and minimums; {@code practiceArea} keeps only the minimums that apply to that area. */
    @GetMapping("/scale")
    FeeScaleView scale(@RequestParam(required = false) String practiceArea) {
        return fees.scale(practiceArea);
    }

    /** Newest first, with the value that applies today. Archived values only when asked. */
    @GetMapping("/jus-values")
    JusValueHistory history(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return jusValues.history(includeArchived);
    }

    @PostMapping("/jus-values")
    ResponseEntity<JusValueView> create(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody JusValueData body) {
        JusValueView created = jusValues.create(user, body);
        return ResponseEntity.created(URI.create("/api/v1/fees/jus-values/" + created.id())).body(created);
    }

    @PostMapping("/jus-values/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        jusValues.archive(user, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/jus-values/{id}/restore")
    ResponseEntity<Void> restore(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID id) {
        jusValues.restore(user, id);
        return ResponseEntity.noContent().build();
    }

    /** Stateless: nothing is stored. */
    @PostMapping("/calculations")
    FeeCalculation calculate(@Valid @RequestBody CalculationRequest body) {
        return fees.calculate(body);
    }
}
