package ar.gestorpenal.casefile;

import java.util.Locale;

/**
 * The case still stores {@link ActionType} and {@link Representation} as enum names ({@code PUBLIC_ON_COMPLAINT}),
 * and the API keeps sending them. The catalogs of the practice area spell the same values as
 * catalog codes ({@code public-on-complaint}): lowercase words separated by hyphens.
 */
final class CatalogCodes {

    private CatalogCodes() {}

    static String of(Enum<?> value) {
        return value.name().toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
