package ar.gestorpenal.fee;

import java.util.List;

/**
 * The firm's JUS values, newest first, and the one that applies today ({@code null} when none does).
 */
record JusValueHistory(JusValueView current, List<JusValueView> values) {}
