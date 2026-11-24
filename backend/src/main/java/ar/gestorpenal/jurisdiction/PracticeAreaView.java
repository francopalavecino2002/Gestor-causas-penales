package ar.gestorpenal.jurisdiction;

import java.time.LocalDate;
import java.util.List;

/**
 * A practice area as the firm sees it (ADR-0032): what it is, its legal source and review flags,
 * and the modules the UI shows or hides by.
 */
public record PracticeAreaView(
        String code,
        String name,
        String law,
        LocalDate reviewedOn,
        String source,
        List<ReviewFlag> flags,
        String note,
        List<PracticeModule> modules) {

    static PracticeAreaView of(PracticeArea area) {
        return new PracticeAreaView(area.code(), area.name(), area.law(), area.reviewedOn(), area.source(),
                area.flags(), area.note(), area.modules());
    }
}
