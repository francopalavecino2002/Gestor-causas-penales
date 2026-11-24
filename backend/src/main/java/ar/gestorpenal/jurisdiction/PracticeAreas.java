package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.tenancy.TenantService;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The practice areas (fueros) of the current firm: the ones its jurisdiction package defines, and
 * the ones the firm has enabled (ADR-0032). The caller must be inside a tenant. Other features ask
 * here whether a case's area has a module, instead of knowing any area by name.
 */
@Service
public class PracticeAreas {

    private final JurisdictionRegistry jurisdictions;
    private final TenantService tenants;

    PracticeAreas(JurisdictionRegistry jurisdictions, TenantService tenants) {
        this.jurisdictions = jurisdictions;
        this.tenants = tenants;
    }

    /** The areas the firm has enabled, in the firm's order. */
    @Transactional(readOnly = true)
    public List<PracticeAreaView> enabled() {
        return tenants.currentEnabledPracticeAreas().stream()
                .flatMap(code -> find(code).stream())
                .map(PracticeAreaView::of)
                .toList();
    }

    /** The area of the firm's jurisdiction, enabled or not. */
    @Transactional(readOnly = true)
    public Optional<PracticeArea> find(String areaCode) {
        return jurisdictions.get(tenants.currentJurisdictionCode()).area(areaCode);
    }

    /** As {@link #find}, but an unknown code is a {@link PracticeAreaNotFoundException}. */
    @Transactional(readOnly = true)
    public PracticeArea get(String areaCode) {
        return find(areaCode).orElseThrow(() -> new PracticeAreaNotFoundException(areaCode));
    }

    /** The area, which must exist and be enabled by the firm: for choosing an area for new work. */
    @Transactional(readOnly = true)
    public PracticeArea requireEnabled(String areaCode) {
        PracticeArea area = get(areaCode);
        if (!tenants.currentEnabledPracticeAreas().contains(areaCode)) {
            throw new PracticeAreaNotEnabledException(areaCode);
        }
        return area;
    }

    @Transactional(readOnly = true)
    public boolean hasModule(String areaCode, PracticeModule module) {
        return get(areaCode).hasModule(module);
    }

    /** Fails with {@link ModuleNotEnabledException} (409) when the area does not declare the module. */
    @Transactional(readOnly = true)
    public void requireModule(String areaCode, PracticeModule module) {
        if (!hasModule(areaCode, module)) {
            throw new ModuleNotEnabledException(module, areaCode);
        }
    }
}
