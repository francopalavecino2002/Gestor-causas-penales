package ar.gestorpenal.jurisdiction;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * What a firm changed in one catalog item: a rename or hidden flag on a built-in item, or an item
 * the firm added. Built-in items themselves stay in the jurisdiction package (ADR-0013).
 */
@Entity
@Audited
@Table(name = "catalog_item_customization")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class CatalogItemCustomization extends TenantScopedEntity {

    static final String CUSTOM_CODE_PREFIX = "custom-";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 40)
    private Catalog catalog;

    @Column(name = "item_code", nullable = false, updatable = false, length = 80)
    private String itemCode;

    @Column(nullable = false, updatable = false)
    private boolean custom;

    /** The firm's name for the item; {@code null} keeps the package name of a built-in item. */
    @Column(length = 200)
    private String name;

    /** Legal source of an item added by the firm; built-in items keep the package's article. */
    @Column(length = 120)
    private String article;

    @Column(nullable = false)
    private boolean hidden;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    private CatalogItemCustomization(
            Catalog catalog, String itemCode, boolean custom, String name, String article, boolean hidden) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
        this.itemCode = Objects.requireNonNull(itemCode, "itemCode");
        this.custom = custom;
        this.name = name;
        this.article = article;
        this.hidden = hidden;
        this.createdAt = Instant.now();
    }

    /** A rename ({@code name} not null) or hidden flag on an item of the jurisdiction package. */
    static CatalogItemCustomization ofBuiltIn(Catalog catalog, String itemCode, String name, boolean hidden) {
        return new CatalogItemCustomization(catalog, itemCode, false, name, null, hidden);
    }

    static CatalogItemCustomization newCustomItem(Catalog catalog, String name, String article) {
        String code = CUSTOM_CODE_PREFIX + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return new CatalogItemCustomization(catalog, code, true, Objects.requireNonNull(name, "name"), article, false);
    }

    void rename(String newName) {
        if (custom && newName == null) {
            throw new InvalidCatalogChangeException("An item added by the firm needs a name");
        }
        this.name = newName;
    }

    void setHidden(boolean hidden) {
        this.hidden = hidden;
    }
}
