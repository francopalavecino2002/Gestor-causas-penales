package ar.gestorpenal.jurisdiction;

/**
 * Whether a practice area is in use by the firm in scope, answered by the feature that owns the records
 * (cases), so this package does not depend on it.
 */
public interface PracticeAreaUsage {

    /** The firm has a case of the area that is not archived. */
    boolean hasActiveCases(String areaCode);
}
