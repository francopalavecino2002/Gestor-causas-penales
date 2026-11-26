package ar.gestorpenal.fee;

import java.math.BigDecimal;

/**
 * What to calculate, already resolved: {@code amount} is {@code null} for a matter that cannot be
 * appraised in money.
 */
record FeeQuery(BigDecimal amount, boolean clientLostEntirely, FeeRole role, FeeInstance instance) {}
