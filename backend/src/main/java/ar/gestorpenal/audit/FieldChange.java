package ar.gestorpenal.audit;

/**
 * One field of one audited change. Values are stored as text ({@code null} when empty) and
 * {@value #REDACTED} for {@link AuditRedacted} fields that hold a value.
 */
public record FieldChange(String field, String oldValue, String newValue) {

    public static final String REDACTED = "[redacted]";
}
