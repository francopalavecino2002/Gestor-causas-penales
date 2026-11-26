package ar.gestorpenal.fee;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * The fees scale of a jurisdiction, as {@code fees.yml} defines it (ADR-0040): the percentages of
 * the amount at stake, the share of the procurador, the appeal and the minimums in JUS. Percentages
 * are written as percent (11 is 11%) and factors as multipliers (0.40 is 40%).
 */
record FeeScale(
        String law,
        String source,
        Percentages scale,
        Factor procurador,
        Factor sponsorAndAttorney,
        Appeal appeal,
        List<FeeMinimum> minimums) {

    FeeScale {
        // Not List.copyOf: an empty YAML entry is a null the loader reports, not a crash.
        minimums = minimums == null ? List.of() : Collections.unmodifiableList(new ArrayList<>(minimums));
    }

    /** Art. 7: the range over the amount, and the floor factor of the party that lost entirely. */
    record Percentages(
            String article,
            BigDecimal minPercent,
            BigDecimal maxPercent,
            BigDecimal losingPartyFloorFactor,
            List<ReviewFlag> flags) {

        Percentages {
            flags = flags == null ? List.of() : List.copyOf(flags);
        }
    }

    /** Art. 10: a multiplier of what the sponsoring lawyer gets. */
    record Factor(String article, BigDecimal factor, List<ReviewFlag> flags) {

        Factor {
            flags = flags == null ? List.of() : List.copyOf(flags);
        }
    }

    /** Art. 15: the share of the first instance fee that an appeal earns. */
    record Appeal(
            String article,
            BigDecimal minPercent,
            BigDecimal maxPercent,
            BigDecimal fullyRevokedPercent,
            List<ReviewFlag> flags) {

        Appeal {
            flags = flags == null ? List.of() : List.copyOf(flags);
        }
    }

    Optional<FeeMinimum> minimum(String code) {
        return minimums.stream().filter(minimum -> minimum.code().equals(code)).findFirst();
    }
}
