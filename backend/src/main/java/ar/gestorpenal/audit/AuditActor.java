package ar.gestorpenal.audit;

import ar.gestorpenal.tenancy.TenantPrincipal;
import java.util.UUID;

/**
 * An authenticated principal that can be named as the author of a change. Its firm must be the
 * firm of the record it changes.
 */
public interface AuditActor extends TenantPrincipal {

    UUID userId();
}
