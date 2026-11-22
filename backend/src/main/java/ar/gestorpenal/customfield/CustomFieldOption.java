package ar.gestorpenal.customfield;

/**
 * One choice of a LIST field. The code is generated from the first label and never changes, because
 * stored values refer to it; the label can be renamed and the option hidden, never removed.
 */
public record CustomFieldOption(String code, String label, boolean hidden) {}
