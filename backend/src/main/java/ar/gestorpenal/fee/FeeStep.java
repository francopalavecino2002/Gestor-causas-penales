package ar.gestorpenal.fee;

import java.math.BigDecimal;

/**
 * One step of a calculation, in Spanish, with the article that supports it.
 *
 * @param amount the amount in pesos after the step (the lower bound when the step has a range); {@code null}
 *     when the step has no amount
 * @param amountTo the upper bound in pesos of a range; {@code null} when the step has a single amount
 */
record FeeStep(String description, String article, BigDecimal amount, BigDecimal amountTo) {}
