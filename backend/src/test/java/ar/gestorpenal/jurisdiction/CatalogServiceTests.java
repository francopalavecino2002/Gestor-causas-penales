package ar.gestorpenal.jurisdiction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
import ar.gestorpenal.jurisdiction.CatalogItem.Origin;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** Per-firm changes on top of the Neuquén package, against a real database. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CatalogServiceTests {

    @Autowired
    private CatalogService catalogs;

    @Autowired
    private CatalogItemCustomizationRepository customizations;

    @Autowired
    private TenantService tenants;

    @Autowired
    private AuditTrail auditTrail;

    private UUID tenantA;
    private UUID tenantB;

    @BeforeEach
    void createTwoFirms() {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
    }

    @Test
    void aNewFirmShouldSeeThePackageAsShipped() {
        CatalogView hearingTypes = TenantContext.callAs(tenantA, () -> catalogs.view("penal", Catalog.HEARING_TYPES, false));

        assertThat(hearingTypes.jurisdiction()).isEqualTo("neuquen");
        assertThat(hearingTypes.packageVersion()).isEqualTo(2);
        assertThat(hearingTypes.flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(hearingTypes.items()).hasSize(28);
        assertThat(hearingTypes.items().getFirst()).satisfies(item -> {
            assertThat(item.code()).isEqualTo("formulacion-de-cargos");
            assertThat(item.name()).isEqualTo(item.sourceName()).isEqualTo("Formulación de cargos");
            assertThat(item.article()).isEqualTo("133");
            assertThat(item.origin()).isEqualTo(Origin.JURISDICTION);
            assertThat(item.hidden()).isFalse();
        });
        assertThat(TenantContext.callAs(tenantA, () -> catalogs.viewAll("penal", false)))
                .extracting(CatalogView::catalog)
                .containsExactly(Catalog.values());
    }

    @Test
    void aRenameShouldKeepTheSourceNameAndArticleAndCanBeUndone() {
        CatalogItem renamed = TenantContext.callAs(tenantA, () ->
                catalogs.updateItem("penal", Catalog.HEARING_TYPES, "formulacion-de-cargos", "  Formalización  ", false));

        assertThat(renamed.name()).isEqualTo("Formalización");
        assertThat(renamed.sourceName()).isEqualTo("Formulación de cargos");
        assertThat(renamed.article()).isEqualTo("133");
        assertThat(firstHearingType(tenantA).name()).isEqualTo("Formalización");

        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "formulacion-de-cargos", null, false));

        assertThat(firstHearingType(tenantA).name()).isEqualTo("Formulación de cargos");
    }

    @Test
    void aHiddenItemShouldOnlyAppearWhenHiddenItemsAreRequested() {
        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "juicio-directo", null, true));

        assertThat(codes(tenantA, Catalog.HEARING_TYPES, false)).doesNotContain("juicio-directo").hasSize(27);
        assertThat(TenantContext.callAs(tenantA, () -> catalogs.view("penal", Catalog.HEARING_TYPES, true)).items())
                .filteredOn(item -> item.code().equals("juicio-directo"))
                .singleElement()
                .extracting(CatalogItem::hidden)
                .isEqualTo(true);

        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "juicio-directo", null, false));

        assertThat(codes(tenantA, Catalog.HEARING_TYPES, false)).contains("juicio-directo");
    }

    @Test
    void aFirmItemShouldBeAddedAtTheEndWithAGeneratedCode() {
        CatalogItem added = TenantContext.callAs(tenantA, () ->
                catalogs.addItem("penal", Catalog.HEARING_TYPES, " Audiencia ficticia de prueba ", " 999 "));

        assertThat(added.code()).startsWith("custom-");
        assertThat(added.name()).isEqualTo("Audiencia ficticia de prueba");
        assertThat(added.article()).isEqualTo("999");
        assertThat(added.sourceName()).isNull();
        assertThat(added.origin()).isEqualTo(Origin.FIRM);
        assertThat(codes(tenantA, Catalog.HEARING_TYPES, false)).endsWith(added.code());

        CatalogItem hidden = TenantContext.callAs(tenantA, () ->
                catalogs.updateItem("penal", Catalog.HEARING_TYPES, added.code(), "Audiencia ficticia", true));

        assertThat(hidden.name()).isEqualTo("Audiencia ficticia");
        assertThat(codes(tenantA, Catalog.HEARING_TYPES, false)).doesNotContain(added.code());
    }

    @Test
    void aFirmItemShouldAlwaysKeepAName() {
        CatalogItem added = TenantContext.callAs(tenantA,
                () -> catalogs.addItem("penal", Catalog.CANCELLATION_REASONS, "Motivo ficticio", null));

        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.updateItem("penal", Catalog.CANCELLATION_REASONS, added.code(), "   ", false)))
                .isInstanceOf(InvalidCatalogChangeException.class);
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.addItem("penal", Catalog.CANCELLATION_REASONS, " ", null)))
                .isInstanceOf(InvalidCatalogChangeException.class);
        assertThat(TenantContext.callAs(tenantA, () -> catalogs.view("penal", Catalog.CANCELLATION_REASONS, false)).items())
                .extracting(CatalogItem::name)
                .endsWith("Motivo ficticio");
    }

    @Test
    void resettingAnUnchangedItemShouldNotStoreAnything() {
        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "otra", "Otra", false));

        assertThat(TenantContext.callAs(tenantA,
                () -> customizations.findByCatalogAndPracticeAreaAndItemCode(Catalog.HEARING_TYPES, "penal", "otra"))).isEmpty();
    }

    @Test
    void catalogsThatDriveBehaviorShouldOnlyAllowRenames() {
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.updateItem("penal", Catalog.STAGES, "juicio", null, true)))
                .isInstanceOf(CatalogChangeNotAllowedException.class);
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.addItem("penal", Catalog.HEARING_STATUSES, "Estado ficticio", null)))
                .isInstanceOf(CatalogChangeNotAllowedException.class);
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.addItem("penal", Catalog.COERCIVE_MEASURES, "Medida ficticia", null)))
                .isInstanceOf(CatalogChangeNotAllowedException.class);

        CatalogItem renamed = TenantContext.callAs(tenantA,
                () -> catalogs.updateItem("penal", Catalog.STAGES, "juicio", "Debate", false));

        assertThat(renamed.name()).isEqualTo("Debate");
    }

    @Test
    void unknownItemsShouldBeReportedAsNotFound() {
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "no-existe", "Algo", false)))
                .isInstanceOf(CatalogItemNotFoundException.class);
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "custom-00000000", "Algo", false)))
                .isInstanceOf(CatalogItemNotFoundException.class);
    }

    @Test
    void aFirmShouldNeverSeeOrChangeAnotherFirmsCatalogs() {
        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "formulacion-de-cargos", "Renombrada en A", false));
        CatalogItem addedByA = TenantContext.callAs(tenantA,
                () -> catalogs.addItem("penal", Catalog.CIRCUMSCRIPTIONS, "Circunscripción ficticia de A", null));

        assertThat(firstHearingType(tenantB).name()).isEqualTo("Formulación de cargos");
        assertThat(codes(tenantB, Catalog.CIRCUMSCRIPTIONS, true)).doesNotContain(addedByA.code()).hasSize(6);
        assertThatThrownBy(() -> TenantContext.runAs(tenantB,
                        () -> catalogs.updateItem("penal", Catalog.CIRCUMSCRIPTIONS, addedByA.code(), "Robada", true)))
                .isInstanceOf(CatalogItemNotFoundException.class);
    }

    @Test
    void changesShouldBeRecordedInTheHistory() {
        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "juicio-tecnico", "Juicio", false));
        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.HEARING_TYPES, "juicio-tecnico", "Juicio", true));

        List<AuditEvent> history = TenantContext.callAs(tenantA, () -> {
            UUID id = customizations.findByCatalogAndPracticeAreaAndItemCode(Catalog.HEARING_TYPES, "penal", "juicio-tecnico").orElseThrow().getId();
            return auditTrail.historyOf(CatalogItemCustomization.class, id);
        });

        assertThat(history).extracting(AuditEvent::getAction).containsExactly(AuditAction.CREATE, AuditAction.UPDATE);
    }

    @Test
    void aCustomizationShouldBelongToItsAreaAndNotLeakToAnother() {
        TenantContext.runAs(tenantA, () -> catalogs.addItem("testarea", Catalog.HEARING_TYPES, "Audiencia de prueba", null));
        TenantContext.runAs(tenantA, () -> catalogs.addItem("penal", Catalog.HEARING_TYPES, "Audiencia penal propia", null));

        assertThat(TenantContext.callAs(tenantA, () -> catalogs.view("testarea", Catalog.HEARING_TYPES, false)).items())
                .extracting(CatalogItem::name)
                .contains("Audiencia de prueba")
                .doesNotContain("Audiencia penal propia");
        assertThat(TenantContext.callAs(tenantA, () -> catalogs.view("penal", Catalog.HEARING_TYPES, false)).items())
                .extracting(CatalogItem::name)
                .contains("Audiencia penal propia")
                .doesNotContain("Audiencia de prueba");
    }

    @Test
    void theSameBuiltInCodeCanBeRenamedIndependentlyInEachArea() {
        TenantContext.runAs(tenantA, () -> catalogs.updateItem("penal", Catalog.CLOSING_OUTCOMES, "sobreseimiento", "Penal", false));

        assertThat(TenantContext.callAs(tenantA, () -> customizations
                        .findByCatalogAndPracticeAreaAndItemCode(Catalog.CLOSING_OUTCOMES, "penal", "sobreseimiento")))
                .isPresent();
        assertThat(TenantContext.callAs(tenantA, () -> customizations
                        .findByCatalogAndPracticeAreaAndItemCode(Catalog.CLOSING_OUTCOMES, "testarea", "sobreseimiento")))
                .isEmpty();
    }

    @Test
    void anAreaCannotChangeAnItemOfAnotherAreasCatalog() {
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> catalogs.updateItem("testarea", Catalog.HEARING_TYPES, "formulacion-de-cargos", "Intruso", false)))
                .isInstanceOf(CatalogItemNotFoundException.class);
    }

    @Test
    void anAreaWithoutAModuleShouldNotProvideItsCatalogs() {
        assertThatThrownBy(() -> TenantContext.callAs(tenantA, () -> catalogs.view("testarea", Catalog.COERCIVE_MEASURES, false)))
                .isInstanceOf(CatalogItemNotFoundException.class);
        assertThat(TenantContext.callAs(tenantA, () -> catalogs.viewAll("testarea", false)))
                .extracting(CatalogView::catalog)
                .doesNotContain(Catalog.COERCIVE_MEASURES, Catalog.PROCEDURAL_RISKS, Catalog.LIBERTY_SITUATIONS,
                        Catalog.ALTERNATIVE_OUTCOMES)
                .contains(Catalog.CIRCUMSCRIPTIONS, Catalog.STAGES);
    }

    @Test
    void aSharedCatalogChangeShouldBeVisibleFromEveryArea() {
        TenantContext.runAs(tenantA, () -> catalogs.addItem("penal", Catalog.CIRCUMSCRIPTIONS, "Circunscripción ficticia", null));

        assertThat(TenantContext.callAs(tenantA, () -> catalogs.view("testarea", Catalog.CIRCUMSCRIPTIONS, false)).items())
                .extracting(CatalogItem::name)
                .contains("Circunscripción ficticia");
        assertThat(TenantContext.callAs(tenantA, () -> customizations
                        .findByCatalogAndPracticeAreaOrderByCreatedAtAscIdAsc(Catalog.CIRCUMSCRIPTIONS, null)))
                .hasSize(1);
    }

    @Test
    void anUnknownAreaShouldBeRejected() {
        assertThatThrownBy(() -> TenantContext.callAs(tenantA, () -> catalogs.viewAll("inexistente", false)))
                .isInstanceOf(PracticeAreaNotFoundException.class);
    }

    private CatalogItem firstHearingType(UUID tenant) {
        return TenantContext.callAs(tenant, () -> catalogs.view("penal", Catalog.HEARING_TYPES, false)).items().getFirst();
    }

    private List<String> codes(UUID tenant, Catalog catalog, boolean includeHidden) {
        return TenantContext.callAs(tenant, () -> catalogs.view("penal", catalog, includeHidden)).items().stream()
                .map(CatalogItem::code)
                .toList();
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
