package ar.gestorpenal.hearing;

import java.util.Set;

/**
 * The coercive measures that deprive a defendant of liberty, by their catalog code. The coercive
 * measures catalog can be hidden but not extended, so these codes are stable (ADR-0013).
 */
final class CustodialMeasures {

    /** Prisión preventiva (arts. 115 to 119). */
    static final String PREVENTIVE_PRISON = "prision-preventiva";

    /** Detención domiciliaria. */
    static final String HOUSE_ARREST = "detencion-domiciliaria";

    static final Set<String> CODES = Set.of(PREVENTIVE_PRISON, HOUSE_ARREST);

    private CustodialMeasures() {}

    static boolean isCustodial(String measureCode) {
        return CODES.contains(measureCode);
    }
}
