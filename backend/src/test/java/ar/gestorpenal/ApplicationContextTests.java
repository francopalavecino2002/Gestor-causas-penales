package ar.gestorpenal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ApplicationContextTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void shouldApplyBaselineMigrationOnStartup() {
        Boolean applied = jdbc.queryForObject(
                "select success from flyway_schema_history where version = '1'", Boolean.class);

        assertThat(applied).isTrue();
    }
}
