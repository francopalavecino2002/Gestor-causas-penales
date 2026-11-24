package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.tenancy.TenantService;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The catalogs of the current firm for one practice area: its jurisdiction package plus its own
 * changes (ADR-0013, ADR-0032). A catalog of the whole jurisdiction (circumscriptions) is the same
 * for every area; every other catalog belongs to the area it is asked for. The caller must be inside
 * a tenant (an authenticated request or a {@code TenantContext} scope).
 */
@Service
public class CatalogService {

    private final JurisdictionRegistry jurisdictions;
    private final TenantService tenants;
    private final PracticeAreas areas;
    private final CatalogItemCustomizationRepository customizations;

    CatalogService(
            JurisdictionRegistry jurisdictions,
            TenantService tenants,
            PracticeAreas areas,
            CatalogItemCustomizationRepository customizations) {
        this.jurisdictions = jurisdictions;
        this.tenants = tenants;
        this.areas = areas;
        this.customizations = customizations;
    }

    /** Every catalog the area provides: the shared ones and the area's own, in {@link Catalog} order. */
    @Transactional(readOnly = true)
    public List<CatalogView> viewAll(String areaCode, boolean includeHidden) {
        PracticeArea area = areas.get(areaCode);
        JurisdictionPackage jurisdiction = currentJurisdiction();
        Map<Catalog, List<CatalogItemCustomization>> rowsByCatalog = customizations
                .findByPracticeAreaOrPracticeAreaIsNullOrderByCreatedAtAscIdAsc(areaCode).stream()
                .collect(Collectors.groupingBy(CatalogItemCustomization::getCatalog));
        return Arrays.stream(Catalog.values())
                .filter(catalog -> definition(jurisdiction, area, catalog) != null)
                .map(catalog -> view(jurisdiction, area, catalog, rowsByCatalog.getOrDefault(catalog, List.of()), includeHidden))
                .toList();
    }

    @Transactional(readOnly = true)
    public CatalogView view(String areaCode, Catalog catalog, boolean includeHidden) {
        PracticeArea area = areas.get(areaCode);
        requireProvided(area, catalog);
        return view(currentJurisdiction(), area, catalog,
                customizations.findByCatalogAndPracticeAreaOrderByCreatedAtAscIdAsc(catalog, scopeOf(area, catalog)),
                includeHidden);
    }

    /** Adds a firm item to an extensible catalog; it gets a generated {@code custom-} code. */
    @Transactional
    public CatalogItem addItem(String areaCode, Catalog catalog, String name, String article) {
        PracticeArea area = areas.get(areaCode);
        requireProvided(area, catalog);
        if (!catalog.extensible()) {
            throw new CatalogChangeNotAllowedException("Items cannot be added to the catalog " + catalog.id());
        }
        String itemName = requireName(name);
        String itemArticle = blankToNull(article);
        return CatalogItem.addedByFirm(customizations.save(
                CatalogItemCustomization.newCustomItem(scopeOf(area, catalog), catalog, itemName, itemArticle)));
    }

    /**
     * Renames and shows or hides an item. For a built-in item, a {@code null} or blank name, or the
     * package's own name, restores the package name; the article never changes.
     */
    @Transactional
    public CatalogItem updateItem(String areaCode, Catalog catalog, String code, String name, boolean hidden) {
        PracticeArea area = areas.get(areaCode);
        requireProvided(area, catalog);
        if (hidden && !catalog.hideable()) {
            throw new CatalogChangeNotAllowedException("Items of the catalog " + catalog.id() + " cannot be hidden");
        }
        String scope = scopeOf(area, catalog);
        if (code.startsWith(CatalogItemCustomization.CUSTOM_CODE_PREFIX)) {
            CatalogItemCustomization item = customizations.findByCatalogAndPracticeAreaAndItemCode(catalog, scope, code)
                    .orElseThrow(() -> notFound(catalog, code));
            item.rename(requireName(name));
            item.setHidden(hidden);
            return CatalogItem.addedByFirm(item);
        }
        CatalogItemDefinition definition = definition(currentJurisdiction(), area, catalog).item(code)
                .orElseThrow(() -> notFound(catalog, code));
        String requestedName = blankToNull(name);
        String newName = definition.name().equals(requestedName) ? null : requestedName;
        Optional<CatalogItemCustomization> existing =
                customizations.findByCatalogAndPracticeAreaAndItemCode(catalog, scope, code);
        if (existing.isPresent()) {
            existing.get().rename(newName);
            existing.get().setHidden(hidden);
            return CatalogItem.builtIn(definition, existing.get());
        }
        if (newName == null && !hidden) {
            return CatalogItem.builtIn(definition, null);
        }
        CatalogItemCustomization created =
                customizations.save(CatalogItemCustomization.ofBuiltIn(scope, catalog, code, newName, hidden));
        return CatalogItem.builtIn(definition, created);
    }

    private JurisdictionPackage currentJurisdiction() {
        return jurisdictions.get(tenants.currentJurisdictionCode());
    }

    /** The package definition of the catalog for this area, or {@code null} when the area does not provide it. */
    private static CatalogDefinition definition(JurisdictionPackage jurisdiction, PracticeArea area, Catalog catalog) {
        return catalog.scope() == Catalog.Scope.JURISDICTION ? jurisdiction.sharedCatalog(catalog) : area.catalog(catalog);
    }

    /** The practice area that owns the customizations of the catalog: none for a shared catalog. */
    private static String scopeOf(PracticeArea area, Catalog catalog) {
        return catalog.scope() == Catalog.Scope.JURISDICTION ? null : area.code();
    }

    private void requireProvided(PracticeArea area, Catalog catalog) {
        if (definition(currentJurisdiction(), area, catalog) == null) {
            throw new CatalogItemNotFoundException(
                    "The practice area " + area.code() + " has no catalog " + catalog.id());
        }
    }

    private static CatalogView view(
            JurisdictionPackage jurisdiction,
            PracticeArea area,
            Catalog catalog,
            List<CatalogItemCustomization> rows,
            boolean includeHidden) {
        CatalogDefinition definition = definition(jurisdiction, area, catalog);
        Map<String, CatalogItemCustomization> byCode = rows.stream()
                .collect(Collectors.toMap(CatalogItemCustomization::getItemCode, Function.identity()));
        List<CatalogItem> items = new ArrayList<>();
        definition.items().forEach(item -> items.add(CatalogItem.builtIn(item, byCode.get(item.code()))));
        rows.stream().filter(CatalogItemCustomization::isCustom).forEach(row -> items.add(CatalogItem.addedByFirm(row)));
        return new CatalogView(
                catalog,
                jurisdiction.code(),
                jurisdiction.version(),
                definition.source(),
                definition.flags(),
                definition.note(),
                catalog.hideable(),
                catalog.extensible(),
                items.stream().filter(item -> includeHidden || !item.hidden()).toList());
    }

    private static String requireName(String name) {
        String stripped = blankToNull(name);
        if (stripped == null) {
            throw new InvalidCatalogChangeException("The item needs a name");
        }
        return stripped;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static CatalogItemNotFoundException notFound(Catalog catalog, String code) {
        return new CatalogItemNotFoundException("The catalog " + catalog.id() + " has no item " + code);
    }
}
