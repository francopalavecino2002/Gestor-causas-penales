package ar.gestorpenal.casefile;

import java.util.Locale;

/**
 * A case's action type and represented side are free codes of its practice area's catalogs
 * ({@code public-on-complaint}, {@code ordinario}): lowercase words separated by hyphens.
 *
 * <p>The API used to send the two values as Java enum names ({@code PUBLIC_ON_COMPLAINT}), and the
 * frontend still does. The wire format keeps that spelling, which maps one to one to a code, so the
 * criminal screens work unchanged: a request may use either spelling and a response always uses the
 * enum-like one. The practice-area UI (T43) moves to plain codes and then this class goes away.
 */
final class CatalogCodes {

    private CatalogCodes() {}

    /** The catalog code of a value as sent by a client, in either spelling; {@code null} stays {@code null}. */
    static String fromWire(String value) {
        return value == null ? null : value.strip().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    /** The value a client reads for a stored catalog code; {@code null} stays {@code null}. */
    static String toWire(String code) {
        return code == null ? null : code.toUpperCase(Locale.ROOT).replace('-', '_');
    }
}
