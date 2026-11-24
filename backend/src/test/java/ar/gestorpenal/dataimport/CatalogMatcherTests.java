package ar.gestorpenal.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogService;
import ar.gestorpenal.tenancy.TenantContext;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class CatalogMatcherTests extends ImportApiTestSupport {

    @Autowired
    private CatalogMatcher matcher;

    @Autowired
    private CatalogService catalogs;

    @Autowired
    private JdbcTemplate jdbc;

    private String codeFor(String cell) {
        ImportRow row = ImportRow.of(2, Map.of("tipo_audiencia", cell));
        return TenantContext.callAs(tenantA,
                () -> matcher.code(row, "tipo_audiencia", "penal", Catalog.HEARING_TYPES, new ImportContext()));
    }

    @Test
    void shouldMatchAnItemByItsCode() {
        assertThat(codeFor("formulacion-de-cargos")).isEqualTo("formulacion-de-cargos");
    }

    @Test
    void shouldMatchAnItemByItsVisibleNameIgnoringCaseAndAccents() {
        assertThat(codeFor("Formulación de cargos")).isEqualTo("formulacion-de-cargos");
        assertThat(codeFor("FORMULACION  DE CARGOS")).isEqualTo("formulacion-de-cargos");
    }

    @Test
    void shouldMatchTheNameTheFirmGaveToAnItemAndStillItsCode() {
        TenantContext.runAs(tenantA, () ->
                catalogs.updateItem("penal", Catalog.HEARING_TYPES, "formulacion-de-cargos", "Cargos (nombre propio)", false));

        assertThat(codeFor("Cargos (nombre propio)")).isEqualTo("formulacion-de-cargos");
        assertThat(codeFor("formulacion-de-cargos")).isEqualTo("formulacion-de-cargos");
    }

    @Test
    void shouldAddAnErrorAndReturnNullForAValueThatIsNotInTheCatalog() {
        ImportRow row = ImportRow.of(2, Map.of("tipo_audiencia", "audiencia inventada"));

        String code = TenantContext.callAs(tenantA,
                () -> matcher.code(row, "tipo_audiencia", "penal", Catalog.HEARING_TYPES, new ImportContext()));

        assertThat(code).isNull();
        assertThatThrownBy(row::throwIfErrors).isInstanceOf(RowException.class);
    }

    @Test
    void shouldNotMatchAHiddenItem() {
        TenantContext.runAs(tenantA, () ->
                catalogs.updateItem("penal", Catalog.HEARING_TYPES, "formulacion-de-cargos", null, true));

        assertThat(codeFor("formulacion-de-cargos")).isNull();
    }

    @Test
    void shouldReturnNullWithoutErrorForABlankCell() {
        ImportRow row = ImportRow.of(2, Map.of("tipo_audiencia", " "));

        String code = TenantContext.callAs(tenantA,
                () -> matcher.code(row, "tipo_audiencia", "penal", Catalog.HEARING_TYPES, new ImportContext()));

        assertThat(code).isNull();
        assertThatCode(row::throwIfErrors).doesNotThrowAnyException();
    }

    @Test
    void shouldMatchAgainstTheCatalogOfTheAreaItIsAskedFor() {
        jdbc.update("update tenant set enabled_practice_areas = '{penal,civil}' where id = ?", tenantA);
        ImportRow row = ImportRow.of(2, Map.of("tipo_audiencia", "Audiencia preliminar"));
        ImportRow penalName = ImportRow.of(2, Map.of("tipo_audiencia", "formulacion-de-cargos"));

        String civil = TenantContext.callAs(tenantA,
                () -> matcher.code(row, "tipo_audiencia", "civil", Catalog.HEARING_TYPES, new ImportContext()));
        String penalCodeInCivil = TenantContext.callAs(tenantA,
                () -> matcher.code(penalName, "tipo_audiencia", "civil", Catalog.HEARING_TYPES, new ImportContext()));

        assertThat(civil).isEqualTo("preliminar");
        assertThat(penalCodeInCivil).isNull();
        assertThatThrownBy(penalName::throwIfErrors).isInstanceOf(RowException.class);
    }

    @Test
    void shouldApplyAnAliasOnlyWhenTheAreaOffersItsCode() {
        jdbc.update("update tenant set enabled_practice_areas = '{penal,civil}' where id = ?", tenantA);
        Map<String, String> aliases = Map.of("publica", "public");
        ImportRow inPenal = ImportRow.of(2, Map.of("tipo_accion", "Publica"));
        ImportRow inCivil = ImportRow.of(2, Map.of("tipo_accion", "publica"));

        String penal = TenantContext.callAs(tenantA,
                () -> matcher.code(inPenal, "tipo_accion", "penal", Catalog.ACTION_TYPES, aliases, new ImportContext()));
        String civil = TenantContext.callAs(tenantA,
                () -> matcher.code(inCivil, "tipo_accion", "civil", Catalog.ACTION_TYPES, aliases, new ImportContext()));

        assertThat(penal).isEqualTo("public");
        assertThat(civil).isNull();
    }

    @Test
    void shouldMatchAPracticeAreaByCodeOrNameAndRefuseOneTheFirmHasNotEnabled() {
        jdbc.update("update tenant set enabled_practice_areas = '{penal,civil}' where id = ?", tenantA);
        ImportContext context = new ImportContext();
        ImportRow byName = ImportRow.of(2, Map.of("fuero", "Civil y comercial"));
        ImportRow notEnabled = ImportRow.of(2, Map.of("fuero", "familia"));
        ImportRow blank = ImportRow.of(2, Map.of("fuero", " "));

        assertThat(TenantContext.callAs(tenantA, () -> matcher.practiceArea(byName, "fuero", context))).isEqualTo("civil");
        assertThat(TenantContext.callAs(tenantA, () -> matcher.practiceArea(notEnabled, "fuero", context))).isNull();
        assertThat(TenantContext.callAs(tenantA, () -> matcher.practiceArea(blank, "fuero", context))).isNull();
        assertThatThrownBy(notEnabled::throwIfErrors)
                .isInstanceOfSatisfying(RowException.class, e -> assertThat(e.errors().get(0).message())
                        .contains("no está habilitado").contains("penal, civil"));
        assertThatCode(blank::throwIfErrors).doesNotThrowAnyException();
    }
}
