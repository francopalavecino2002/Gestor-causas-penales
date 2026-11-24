package ar.gestorpenal.casefile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.TestcontainersConfiguration;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * V13 (free catalog codes and the case's own course, ADR-0032) applied over data written by V12: a
 * scratch schema is migrated to version 12, filled with cases that store the old enum names, and then
 * migrated on.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CaseCatalogCodesMigrationTests {

    private static final String SCHEMA = "migration_probe_codes";

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbc;

    @AfterEach
    void dropScratchSchema() {
        jdbc.execute("drop schema if exists " + SCHEMA + " cascade");
    }

    private void insertCase(String caption, String actionType, String represents) {
        jdbc.update("""
                insert into migration_probe_codes.case_file
                    (tenant_id, caption, circumscription_code, action_type, represents, practice_area)
                select id, ?, 'i-confluencia', ?, ?, 'penal' from migration_probe_codes.tenant
                """, caption, actionType, represents);
    }

    @Test
    void existingCasesShouldKeepTheirActionTypeAndSideAsCatalogCodesAndHaveNoOwnCourse() {
        flyway("12").migrate();
        jdbc.update("insert into " + SCHEMA + ".tenant (name, slug) values ('Estudio Ficticio', 'estudio-ficticio')");
        insertCase("Publica", "PUBLIC", "DEFENCE");
        insertCase("Instancia", "PUBLIC_ON_COMPLAINT", "PRIVATE_PROSECUTION");
        insertCase("Privada", "PRIVATE", "DEFENCE");

        flyway(null).migrate();

        List<Map<String, Object>> rows = jdbc.queryForList(
                "select caption, action_type, represents, stage_code, status, closing_outcome_code "
                        + "from migration_probe_codes.case_file order by caption");
        assertThat(rows).extracting(row -> row.get("caption") + ":" + row.get("action_type") + ":" + row.get("represents"))
                .containsExactly(
                        "Instancia:public-on-complaint:private-prosecution",
                        "Privada:private:defence",
                        "Publica:public:defence");
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.get("stage_code")).isNull();
            assertThat(row.get("status")).isNull();
            assertThat(row.get("closing_outcome_code")).isNull();
        });
    }

    @Test
    void theColumnsShouldAcceptTheCodesOfAnyAreaAndTheCourseRulesShouldHold() {
        flyway(null).migrate();
        jdbc.update("insert into " + SCHEMA + ".tenant (name, slug) values ('Estudio Ficticio', 'estudio-ficticio')");

        insertCase("Civil", "sumarisimo", "demandado");
        assertThat(jdbc.queryForObject("select count(*) from migration_probe_codes.case_file", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> insertCase("Mal", "PUBLIC", "DEFENCE")).hasMessageContaining("case_file_action_type_ck");

        String setCourse = "update migration_probe_codes.case_file set stage_code = ?, status = ?, closing_outcome_code = ?";
        jdbc.update(setCourse, "prueba", "ACTIVE", null);
        jdbc.update(setCourse, "cerrada", "CLOSED", "acuerdo");
        assertThatThrownBy(() -> jdbc.update(setCourse, "prueba", "CLOSED", "acuerdo"))
                .hasMessageContaining("case_file_course_ck");
        assertThatThrownBy(() -> jdbc.update(setCourse, "cerrada", "CLOSED", null))
                .hasMessageContaining("case_file_course_ck");
        assertThatThrownBy(() -> jdbc.update(setCourse, "prueba", null, null))
                .hasMessageContaining("case_file_course_ck");
        assertThatThrownBy(() -> jdbc.update(setCourse, "prueba", "ACTIVE", "acuerdo"))
                .hasMessageContaining("case_file_course_ck");
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
