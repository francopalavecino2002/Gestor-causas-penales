package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.Tenant;
import ar.gestorpenal.user.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The firm's catalogs (ADR-0013), per practice area (ADR-0032; {@code area} defaults to penal, so
 * clients that do not know areas keep working). Every member can read them; only the owner (titular) changes
 * them, because a change applies to the whole firm.
 */
@RestController
@RequestMapping("/api/v1/catalogs")
class CatalogController {

    private final CatalogService catalogs;
    private final PracticeAreas areas;

    CatalogController(CatalogService catalogs, PracticeAreas areas) {
        this.catalogs = catalogs;
        this.areas = areas;
    }

    record NewItemRequest(
            @NotBlank @Size(max = JurisdictionPackageLoader.MAX_NAME_LENGTH) String name,
            @Size(max = JurisdictionPackageLoader.MAX_ARTICLE_LENGTH) String article) {}

    /** {@code name} null or blank restores the package name of a built-in item. */
    record ItemChangeRequest(@Size(max = JurisdictionPackageLoader.MAX_NAME_LENGTH) String name, @NotNull Boolean hidden) {}

    /** {@code area} is a practice area the firm has enabled; the catalogs shared by every area are in each. */
    @GetMapping
    List<CatalogView> all(
            @RequestParam(defaultValue = Tenant.DEFAULT_PRACTICE_AREA) String area,
            @RequestParam(defaultValue = "false") boolean includeHidden) {
        return catalogs.viewAll(areas.requireEnabled(area).code(), includeHidden);
    }

    @GetMapping("/{catalogId}")
    CatalogView one(
            @PathVariable String catalogId,
            @RequestParam(defaultValue = Tenant.DEFAULT_PRACTICE_AREA) String area,
            @RequestParam(defaultValue = "false") boolean includeHidden) {
        return catalogs.view(areas.requireEnabled(area).code(), catalog(catalogId), includeHidden);
    }

    @PostMapping("/{catalogId}/items")
    ResponseEntity<CatalogItem> add(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String catalogId,
            @RequestParam(defaultValue = Tenant.DEFAULT_PRACTICE_AREA) String area,
            @Valid @RequestBody NewItemRequest body) {
        requireOwner(user);
        Catalog catalog = catalog(catalogId);
        String areaCode = areas.requireEnabled(area).code();
        CatalogItem item = catalogs.addItem(areaCode, catalog, body.name(), body.article());
        URI location = URI.create("/api/v1/catalogs/" + catalog.id() + "/items/" + item.code() + "?area=" + areaCode);
        return ResponseEntity.created(location).body(item);
    }

    @PutMapping("/{catalogId}/items/{code}")
    CatalogItem update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String catalogId,
            @PathVariable String code,
            @RequestParam(defaultValue = Tenant.DEFAULT_PRACTICE_AREA) String area,
            @Valid @RequestBody ItemChangeRequest body) {
        requireOwner(user);
        return catalogs.updateItem(areas.requireEnabled(area).code(), catalog(catalogId), code, body.name(), body.hidden());
    }

    private static Catalog catalog(String id) {
        return Catalog.fromId(id).orElseThrow(() -> new CatalogItemNotFoundException("There is no catalog " + id));
    }

    private static void requireOwner(AuthenticatedUser user) {
        if (user.role() != Role.OWNER) {
            throw new AccessDeniedException("Only the firm owner can change catalogs");
        }
    }
}
