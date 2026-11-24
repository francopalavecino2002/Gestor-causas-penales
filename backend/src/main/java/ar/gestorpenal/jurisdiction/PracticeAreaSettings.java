package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.audit.AuditJournal;
import ar.gestorpenal.audit.FieldChange;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.Role;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which practice areas the firm works in (ADR-0032). Every member reads them; only the owner changes
 * them, because they apply to the whole firm. The change is validated against the jurisdiction package
 * and written to the change history.
 */
@Service
public class PracticeAreaSettings {

    static final String AUDITED_FIELD = "enabledPracticeAreas";

    private final JurisdictionRegistry jurisdictions;
    private final TenantService tenants;
    private final PracticeAreaUsage usage;
    private final AuditJournal journal;

    PracticeAreaSettings(
            JurisdictionRegistry jurisdictions, TenantService tenants, PracticeAreaUsage usage, AuditJournal journal) {
        this.jurisdictions = jurisdictions;
        this.tenants = tenants;
        this.usage = usage;
        this.journal = journal;
    }

    /** Every area of the firm's jurisdiction package, the default one first, with whether it is on. */
    @Transactional(readOnly = true)
    public List<PracticeAreaOption> available() {
        Set<String> enabled = Set.copyOf(tenants.currentEnabledPracticeAreas());
        return packageAreas().stream()
                .map(area -> PracticeAreaOption.of(area, enabled.contains(area.code())))
                .toList();
    }

    /**
     * Turns on exactly the given areas (duplicates ignored), in the order of {@link #available}. There must be at
     * least one, each must exist in the package, and an area with active cases cannot be turned off.
     */
    @Transactional
    public List<PracticeAreaOption> replaceEnabled(AuthenticatedUser user, List<String> codes) {
        if (user.role() != Role.OWNER) {
            throw new AccessDeniedException("Only the firm owner can choose the practice areas");
        }
        Set<String> wanted = new LinkedHashSet<>();
        for (String code : codes == null ? List.<String>of() : codes) {
            if (code == null || code.isBlank()) {
                throw new InvalidPracticeAreasException("A practice area code cannot be blank");
            }
            wanted.add(code.strip());
        }
        if (wanted.isEmpty()) {
            throw new InvalidPracticeAreasException("A firm works in at least one practice area");
        }
        List<PracticeArea> areas = packageAreas();
        for (String code : wanted) {
            if (areas.stream().noneMatch(area -> area.code().equals(code))) {
                throw new InvalidPracticeAreasException("A practice area is not in the jurisdiction package");
            }
        }
        // Locks the firm's row: concurrent changes serialize, and cases being opened finish first.
        List<String> current = tenants.lockCurrentEnabledPracticeAreas();
        for (String code : current) {
            if (!wanted.contains(code) && usage.hasActiveCases(code)) {
                throw new PracticeAreaInUseException(code);
            }
        }
        List<String> next = areas.stream().map(PracticeArea::code).filter(wanted::contains).toList();
        if (!next.equals(current)) {
            UUID tenantId = tenants.changeCurrentEnabledPracticeAreas(next);
            journal.recordUpdate(tenantId, Tenant.class, tenantId,
                    List.of(new FieldChange(AUDITED_FIELD, String.join(",", current), String.join(",", next))));
        }
        return available();
    }

    /**
     * The package's areas, the default one (the one every firm starts with) first and then in the
     * package's order, so the list reads the same in every screen whatever is on.
     */
    private List<PracticeArea> packageAreas() {
        return jurisdictions.get(tenants.currentJurisdictionCode()).areas().values().stream()
                .sorted(Comparator.comparing(area -> !Tenant.DEFAULT_PRACTICE_AREA.equals(area.code())))
                .toList();
    }
}
