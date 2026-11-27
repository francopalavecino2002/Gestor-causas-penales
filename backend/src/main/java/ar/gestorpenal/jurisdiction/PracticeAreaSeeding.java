package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantService;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point the demo data uses to turn practice areas on without a logged-in
 * owner. It trusts its caller, who names areas of the package, and writes no change history. Call it
 * inside a tenant scope, outside any transaction.
 */
@Service
public class PracticeAreaSeeding {

    private final JurisdictionRegistry jurisdictions;
    private final TenantService tenants;

    PracticeAreaSeeding(JurisdictionRegistry jurisdictions, TenantService tenants) {
        this.jurisdictions = jurisdictions;
        this.tenants = tenants;
    }

    /**
     * Turns on the given areas next to the ones already on, never turning any off, in the order of the
     * package with the default area first. Does nothing when they are all on already.
     */
    @Transactional
    public void enable(String... areaCodes) {
        Set<String> wanted = new HashSet<>(tenants.currentEnabledPracticeAreas());
        wanted.addAll(List.of(areaCodes));
        List<String> next = jurisdictions.get(tenants.currentJurisdictionCode()).areas().values().stream()
                .map(PracticeArea::code)
                .filter(wanted::contains)
                .sorted(Comparator.comparing(code -> !Tenant.DEFAULT_PRACTICE_AREA.equals(code)))
                .toList();
        if (!next.equals(tenants.currentEnabledPracticeAreas())) {
            tenants.changeCurrentEnabledPracticeAreas(next);
        }
    }
}
