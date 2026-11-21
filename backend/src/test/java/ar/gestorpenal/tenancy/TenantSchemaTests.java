package ar.gestorpenal.tenancy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.TestcontainersConfiguration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TenantSchemaTests {

    @Autowired
    private TenantRepository tenants;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void shouldCreateATenantWithNeuquenAsDefaultJurisdiction() {
        String slug = uniqueSlug();
        tenants.save(new Tenant("Estudio Ficticio Gamma", slug));

        Tenant found = tenants.findBySlug(slug).orElseThrow();

        assertThat(found.getJurisdictionCode()).isEqualTo("neuquen");
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(found.getArchivedAt()).isNull();
    }

    @Test
    void shouldRejectADuplicateSlug() {
        String slug = uniqueSlug();
        tenants.save(new Tenant("Estudio Ficticio Delta", slug));

        assertThatThrownBy(() -> tenants.save(new Tenant("Estudio Ficticio Epsilon", slug)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void shouldRejectASlugOutsideTheUrlSafeFormat() {
        assertThatThrownBy(() -> tenants.save(new Tenant("Estudio Ficticio Zeta", "Not A Slug")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void shouldRejectABlankName() {
        assertThatThrownBy(() -> tenants.save(new Tenant("   ", uniqueSlug())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void shouldRejectTheNoTenantSentinelAsATenantId() {
        assertThatThrownBy(() -> jdbc.update(
                        "insert into tenant (id, name, slug) values (?, 'Estudio Ficticio Nulo', ?)",
                        CurrentTenantResolver.NO_TENANT,
                        uniqueSlug()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private static String uniqueSlug() {
        return "estudio-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
