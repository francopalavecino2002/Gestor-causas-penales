package ar.gestorpenal.fee;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A fee calculation as the client sends it. Wrapper types on purpose: a missing value means "the
 * default" ({@code false}, {@code SPONSOR}, {@code FIRST}, today).
 *
 * @param amount the amount of the process in pesos; {@code null} for a matter that cannot be appraised in money
 * @param minimumCode the kind of matter, a code of the scale's minimums
 * @param date the day whose JUS value applies; {@code null} is today
 */
record CalculationRequest(
        @DecimalMin("0") @Digits(integer = 15, fraction = 2) BigDecimal amount,
        @NotBlank String minimumCode,
        Boolean clientLostEntirely,
        FeeRole role,
        FeeInstance instance,
        LocalDate date) {

    boolean lostEntirely() {
        return Boolean.TRUE.equals(clientLostEntirely);
    }

    FeeRole roleOrDefault() {
        return role == null ? FeeRole.SPONSOR : role;
    }

    FeeInstance instanceOrDefault() {
        return instance == null ? FeeInstance.FIRST : instance;
    }
}
