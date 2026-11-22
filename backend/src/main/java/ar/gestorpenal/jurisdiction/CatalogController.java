package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.security.AuthenticatedUser;
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
 * The firm's catalogs (ADR-0013). Every member can read them; only the owner (titular) changes
 * them, because a change applies to the whole firm.
 */
@RestController
@RequestMapping("/api/v1/catalogs")
class CatalogController {

    private final CatalogService catalogs;

    CatalogController(CatalogService catalogs) {
        this.catalogs = catalogs;
    }

    record NewItemRequest(
            @NotBlank @Size(max = JurisdictionPackageLoader.MAX_NAME_LENGTH) String name,
            @Size(max = JurisdictionPackageLoader.MAX_ARTICLE_LENGTH) String article) {}

    /** {@code name} null or blank restores the package name of a built-in item. */
    record ItemChangeRequest(@Size(max = JurisdictionPackageLoader.MAX_NAME_LENGTH) String name, @NotNull Boolean hidden) {}

    @GetMapping
    List<CatalogView> all(@RequestParam(defaultValue = "false") boolean includeHidden) {
        return catalogs.viewAll(includeHidden);
    }

    @GetMapping("/{catalogId}")
    CatalogView one(@PathVariable String catalogId, @RequestParam(defaultValue = "false") boolean includeHidden) {
        return catalogs.view(catalog(catalogId), includeHidden);
    }

    @PostMapping("/{catalogId}/items")
    ResponseEntity<CatalogItem> add(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String catalogId,
            @Valid @RequestBody NewItemRequest body) {
        requireOwner(user);
        Catalog catalog = catalog(catalogId);
        CatalogItem item = catalogs.addItem(catalog, body.name(), body.article());
        URI location = URI.create("/api/v1/catalogs/" + catalog.id() + "/items/" + item.code());
        return ResponseEntity.created(location).body(item);
    }

    @PutMapping("/{catalogId}/items/{code}")
    CatalogItem update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable String catalogId,
            @PathVariable String code,
            @Valid @RequestBody ItemChangeRequest body) {
        requireOwner(user);
        return catalogs.updateItem(catalog(catalogId), code, body.name(), body.hidden());
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
