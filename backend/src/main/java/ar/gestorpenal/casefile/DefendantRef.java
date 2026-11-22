package ar.gestorpenal.casefile;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The few facts other features (hearings, coercive measures, deadlines) need about a defendant.
 *
 * @param rebellionDeclaredOn rebeldía (art. 52), which suspends the defendant's deadlines; may be {@code null}
 * @param rebellionLiftedOn {@code null} while the rebellion lasts
 */
public record DefendantRef(
        UUID id,
        UUID caseId,
        UUID personId,
        String displayName,
        boolean archived,
        LocalDate rebellionDeclaredOn,
        LocalDate rebellionLiftedOn) {}
