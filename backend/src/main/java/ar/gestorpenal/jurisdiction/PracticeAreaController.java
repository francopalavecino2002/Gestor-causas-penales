package ar.gestorpenal.jurisdiction;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The practice areas the current firm works in, with their modules (ADR-0032). */
@RestController
@RequestMapping("/api/v1/practice-areas")
class PracticeAreaController {

    private final PracticeAreas areas;

    PracticeAreaController(PracticeAreas areas) {
        this.areas = areas;
    }

    @GetMapping
    List<PracticeAreaView> enabled() {
        return areas.enabled();
    }
}
