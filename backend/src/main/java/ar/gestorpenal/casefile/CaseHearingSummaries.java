package ar.gestorpenal.casefile;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * What the case summary shows about hearings and detainees, implemented by the hearing feature.
 * Declared here so {@code casefile} does not depend on {@code hearing} (same pattern as
 * {@code PersonCaseRoles}).
 */
public interface CaseHearingSummaries {

    /** Active defendants with an active custodial measure, per case; cases without any are absent. */
    Map<UUID, Integer> detaineeCounts(Collection<UUID> caseIds);

    /** The earliest upcoming hearing that is still pending, per case; cases without one are absent. */
    Map<UUID, NextHearing> nextHearings(Collection<UUID> caseIds);
}
