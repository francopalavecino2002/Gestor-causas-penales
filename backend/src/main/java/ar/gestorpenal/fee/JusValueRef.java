package ar.gestorpenal.fee;

import java.math.BigDecimal;
import java.time.LocalDate;

/** The value of the JUS a calculation used, and the day it applies from. */
record JusValueRef(BigDecimal value, LocalDate validFrom) {}
