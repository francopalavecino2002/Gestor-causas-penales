package ar.gestorpenal.jurisdiction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.TestcontainersConfiguration;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * V12 (practice areas, ADR-0032) applied over data written by V11: a scratch schema is migrated to
 * version 11, filled with the rows of a firm that only knows criminal cases, and then migrated on.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class PracticeAreaMigrationTests {

    private static final String SCHEMA = "migration_probe";

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbc;

    @AfterEach
    void dropScratchSchema() {
        jdbc.execute("drop schema if exists " + SCHEMA + " cascade");
    }

    @Test
    void existingCasesAndCustomizationsShouldBecomePenalAndSharedCatalogsShouldHaveNoArea() {
        flyway("11").migrate();
        jdbc.update("insert into " + SCHEMA + ".tenant (name, slug) values ('Estudio Ficticio', 'estudio-ficticio')");
        jdbc.update("""
                insert into migration_probe.case_file
                    (tenant_id, caption, circumscription_code, action_type, represents)
                select id, 'Causa ficticia', 'i-confluencia', 'PUBLIC', 'DEFENCE' from migration_probe.tenant
                """);
        jdbc.update("""
                insert into migration_probe.catalog_item_customization (tenant_id, catalog, item_code, custom, name, hidden)
                select id, 'HEARING_TYPES', 'otra', false, 'Otra audiencia', false from migration_probe.tenant
                """);
        jdbc.update("""
                insert into migration_probe.catalog_item_customization (tenant_id, catalog, item_code, custom, name, hidden)
                select id, 'CIRCUMSCRIPTIONS', 'i-confluencia', false, 'Confluencia', false from migration_probe.tenant
                """);

        flyway(null).migrate();

        assertThat(jdbc.queryForObject("select practice_area from migration_probe.case_file", String.class))
                .isEqualTo("penal");
        assertThat(jdbc.queryForObject(
                        "select practice_area from migration_probe.catalog_item_customization where catalog = 'HEARING_TYPES'",
                        String.class))
                .isEqualTo("penal");
        assertThat(jdbc.queryForObject(
                        "select practice_area from migration_probe.catalog_item_customization where catalog = 'CIRCUMSCRIPTIONS'",
                        String.class))
                .isNull();
        assertThat(jdbc.queryForObject(
                        "select enabled_practice_areas::text from migration_probe.tenant", String.class))
                .isEqualTo("{penal}");
    }

    @Test
    void theCustomizationKeyShouldTreatTwoMissingAreasAsTheSameAndDifferentAreasAsDifferent() {
        flyway(null).migrate();
        jdbc.update("insert into " + SCHEMA + ".tenant (name, slug) values ('Estudio Ficticio', 'estudio-ficticio')");
        String insert = """
                insert into migration_probe.catalog_item_customization
                    (tenant_id, practice_area, catalog, item_code, custom, name, hidden)
                select id, ?, ?, 'cierre', false, 'Cierre', false from migration_probe.tenant
                """;
        jdbc.update(insert, null, "CIRCUMSCRIPTIONS");
        jdbc.update(insert, "penal", "CLOSING_OUTCOMES");
        jdbc.update(insert, "testarea", "CLOSING_OUTCOMES");

        assertThatThrownBy(() -> jdbc.update(insert, null, "CIRCUMSCRIPTIONS"))
                .isInstanceOf(DuplicateKeyException.class);
        assertThatThrownBy(() -> jdbc.update(insert, "penal", "CLOSING_OUTCOMES"))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void aFirmShouldNeedAtLeastOnePracticeArea() {
        flyway(null).migrate();
        jdbc.update("insert into " + SCHEMA + ".tenant (name, slug) values ('Estudio Ficticio', 'estudio-ficticio')");

        assertThatThrownBy(() -> jdbc.update("update migration_probe.tenant set enabled_practice_areas = '{}'"))
                .hasMessageContaining("tenant_enabled_practice_areas_ck");
    }

    /** A scratch schema with the real migrations, up to {@code target} (the latest when {@code null}). */
    private Flyway flyway(String target) {
        var configuration = Flyway.configure()
                .dataSource(dataSource)
                .schemas(SCHEMA)
                .locations("classpath:db/migration");
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }
}
