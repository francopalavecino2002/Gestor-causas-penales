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

class CatalogMatcherTests extends ImportApiTestSupport {

    @Autowired
    private CatalogMatcher matcher;

    @Autowired
    private CatalogService catalogs;

    private String codeFor(String cell) {
        ImportRow row = ImportRow.of(2, Map.of("tipo_audiencia", cell));
        return TenantContext.callAs(tenantA,
                () -> matcher.code(row, "tipo_audiencia", Catalog.HEARING_TYPES, new ImportContext()));
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
                catalogs.updateItem(Catalog.HEARING_TYPES, "formulacion-de-cargos", "Cargos (nombre propio)", false));

        assertThat(codeFor("Cargos (nombre propio)")).isEqualTo("formulacion-de-cargos");
        assertThat(codeFor("formulacion-de-cargos")).isEqualTo("formulacion-de-cargos");
    }

    @Test
    void shouldAddAnErrorAndReturnNullForAValueThatIsNotInTheCatalog() {
        ImportRow row = ImportRow.of(2, Map.of("tipo_audiencia", "audiencia inventada"));

        String code = TenantContext.callAs(tenantA,
                () -> matcher.code(row, "tipo_audiencia", Catalog.HEARING_TYPES, new ImportContext()));

        assertThat(code).isNull();
        assertThatThrownBy(row::throwIfErrors).isInstanceOf(RowException.class);
    }

    @Test
    void shouldNotMatchAHiddenItem() {
        TenantContext.runAs(tenantA, () ->
                catalogs.updateItem(Catalog.HEARING_TYPES, "formulacion-de-cargos", null, true));

        assertThat(codeFor("formulacion-de-cargos")).isNull();
    }

    @Test
    void shouldReturnNullWithoutErrorForABlankCell() {
        ImportRow row = ImportRow.of(2, Map.of("tipo_audiencia", " "));

        String code = TenantContext.callAs(tenantA,
                () -> matcher.code(row, "tipo_audiencia", Catalog.HEARING_TYPES, new ImportContext()));

        assertThat(code).isNull();
        assertThatCode(row::throwIfErrors).doesNotThrowAnyException();
    }
}
