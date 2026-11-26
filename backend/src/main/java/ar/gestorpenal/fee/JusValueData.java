package ar.gestorpenal.fee;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A JUS value as the client sends it: pesos with at most two decimals and the day it applies from.
 */
record JusValueData(
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal value,
        @NotNull LocalDate validFrom) {}
