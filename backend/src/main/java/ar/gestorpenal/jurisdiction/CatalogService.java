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
 * The catalogs of the current firm: its jurisdiction package plus its own changes (ADR-0013).
 * The caller must be inside a tenant (an authenticated request or a {@code TenantContext} scope).
 */
@Service
public class CatalogService {

    private final JurisdictionRegistry jurisdictions;
    private final TenantService tenants;
    private final CatalogItemCustomizationRepository customizations;

    CatalogService(
            JurisdictionRegistry jurisdictions,
            TenantService tenants,
            CatalogItemCustomizationRepository customizations) {
        this.jurisdictions = jurisdictions;
        this.tenants = tenants;
        this.customizations = customizations;
    }

    @Transactional(readOnly = true)
    public List<CatalogView> viewAll(boolean includeHidden) {
        JurisdictionPackage jurisdiction = currentJurisdiction();
        Map<Catalog, List<CatalogItemCustomization>> rowsByCatalog = customizations
                .findAllByOrderByCreatedAtAscIdAsc().stream()
                .collect(Collectors.groupingBy(CatalogItemCustomization::getCatalog));
        return Arrays.stream(Catalog.values())
                .map(catalog -> view(jurisdiction, catalog, rowsByCatalog.getOrDefault(catalog, List.of()), includeHidden))
                .toList();
    }

    @Transactional(readOnly = true)
    public CatalogView view(Catalog catalog, boolean includeHidden) {
        return view(currentJurisdiction(), catalog,
                customizations.findByCatalogOrderByCreatedAtAscIdAsc(catalog), includeHidden);
    }

    /** Adds a firm item to an extensible catalog; it gets a generated {@code custom-} code. */
    @Transactional
    public CatalogItem addItem(Catalog catalog, String name, String article) {
        if (!catalog.extensible()) {
            throw new CatalogChangeNotAllowedException("Items cannot be added to the catalog " + catalog.id());
        }
        String itemName = requireName(name);
        String itemArticle = blankToNull(article);
        return CatalogItem.addedByFirm(
                customizations.save(CatalogItemCustomization.newCustomItem(catalog, itemName, itemArticle)));
    }

    /**
     * Renames and shows or hides an item. For a built-in item, a {@code null} or blank name, or the
     * package's own name, restores the package name; the article never changes.
     */
    @Transactional
    public CatalogItem updateItem(Catalog catalog, String code, String name, boolean hidden) {
        if (hidden && !catalog.hideable()) {
            throw new CatalogChangeNotAllowedException("Items of the catalog " + catalog.id() + " cannot be hidden");
        }
        if (code.startsWith(CatalogItemCustomization.CUSTOM_CODE_PREFIX)) {
            CatalogItemCustomization item = customizations.findByCatalogAndItemCode(catalog, code)
                    .orElseThrow(() -> notFound(catalog, code));
            item.rename(requireName(name));
            item.setHidden(hidden);
            return CatalogItem.addedByFirm(item);
        }
        CatalogItemDefinition definition = currentJurisdiction().catalog(catalog).item(code)
                .orElseThrow(() -> notFound(catalog, code));
        String requestedName = blankToNull(name);
        String newName = definition.name().equals(requestedName) ? null : requestedName;
        Optional<CatalogItemCustomization> existing = customizations.findByCatalogAndItemCode(catalog, code);
        if (existing.isPresent()) {
            existing.get().rename(newName);
            existing.get().setHidden(hidden);
            return CatalogItem.builtIn(definition, existing.get());
        }
        if (newName == null && !hidden) {
            return CatalogItem.builtIn(definition, null);
        }
        CatalogItemCustomization created =
                customizations.save(CatalogItemCustomization.ofBuiltIn(catalog, code, newName, hidden));
        return CatalogItem.builtIn(definition, created);
    }

    private JurisdictionPackage currentJurisdiction() {
        return jurisdictions.get(tenants.currentJurisdictionCode());
    }

    private static CatalogView view(
            JurisdictionPackage jurisdiction,
            Catalog catalog,
            List<CatalogItemCustomization> rows,
            boolean includeHidden) {
        CatalogDefinition definition = jurisdiction.catalog(catalog);
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
