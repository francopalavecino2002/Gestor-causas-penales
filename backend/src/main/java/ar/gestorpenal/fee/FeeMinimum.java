package ar.gestorpenal.fee;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The minimum fee in JUS of one kind of matter (art. 9 of the Ley 1594 in Neuquén).
 *
 * @param article where the law sets it, for example {@code art. 9, I, 16}
 * @param note a caveat to show next to it; {@code null} when there is none
 * @param areas the practice areas it applies to (folder names); empty means every area
 */
record FeeMinimum(
        String code,
        String name,
        BigDecimal jus,
        String article,
        List<ReviewFlag> flags,
        String note,
        List<String> areas) {

    FeeMinimum {
        flags = flags == null ? List.of() : List.copyOf(flags);
        // Not List.copyOf: a blank YAML entry is a null the loader reports, not a crash.
        areas = areas == null ? List.of() : Collections.unmodifiableList(new ArrayList<>(areas));
    }

    boolean appliesTo(String practiceArea) {
        return areas.isEmpty() || areas.contains(practiceArea);
    }
}
