package ar.gestorpenal.tenancy;

import java.util.UUID;

/**
 * Implemented by the authenticated principal (T05) so the current tenant is derived from the
 * logged-in user and never from request parameters or headers.
 */
public interface TenantPrincipal {

    UUID tenantId();
}
