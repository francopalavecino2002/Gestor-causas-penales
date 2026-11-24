package ar.gestorpenal.jurisdiction;

import java.time.LocalDate;
import java.util.List;

/**
 * A practice area of the firm's jurisdiction package as the settings screen shows it: what it is, its
 * legal source, review flags and modules, and whether the firm works in it (ADR-0032).
 */
public record PracticeAreaOption(
        String code,
        String name,
        String law,
        LocalDate reviewedOn,
        String source,
        List<ReviewFlag> flags,
        String note,
        List<PracticeModule> modules,
        boolean enabled) {

    static PracticeAreaOption of(PracticeArea area, boolean enabled) {
        return new PracticeAreaOption(area.code(), area.name(), area.law(), area.reviewedOn(), area.source(),
                area.flags(), area.note(), area.modules(), enabled);
    }
}
