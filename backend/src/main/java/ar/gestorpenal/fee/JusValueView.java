package ar.gestorpenal.fee;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** A JUS value of the firm as the API shows it. */
record JusValueView(UUID id, BigDecimal value, LocalDate validFrom, boolean archived, Instant createdAt) {

    static JusValueView of(JusValue jus) {
        return new JusValueView(jus.getId(), jus.getValue(), jus.getValidFrom(), jus.isArchived(), jus.getCreatedAt());
    }
}
