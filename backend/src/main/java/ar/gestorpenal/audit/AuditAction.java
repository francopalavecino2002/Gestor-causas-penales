package ar.gestorpenal.audit;

/** What happened to a record. Records are never deleted, so there is no DELETE (ADR-0010). */
public enum AuditAction {
    CREATE,
    UPDATE,
    /** {@code archivedAt} went from empty to set. */
    ARCHIVE,
    /** {@code archivedAt} went from set back to empty. */
    RESTORE
}
