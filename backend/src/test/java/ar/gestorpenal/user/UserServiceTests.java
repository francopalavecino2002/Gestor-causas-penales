package ar.gestorpenal.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class UserServiceTests {

    private static final String PASSWORD = "clave-ficticia-larga";

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository users;

    @Autowired
    private TenantService tenants;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private UUID tenantA;
    private UUID tenantB;

    @BeforeEach
    void createTwoFirms() {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
    }

    @Test
    void shouldStoreABcryptHashAndANormalizedEmail() {
        AppUser user = TenantContext.callAs(tenantA,
                () -> userService.createUser("  Ana.Ficticia@Ejemplo.TEST ", " Ana Ficticia ", PASSWORD, Role.LAWYER));

        assertThat(user.getTenantId()).isEqualTo(tenantA);
        assertThat(user.getEmail()).isEqualTo("ana.ficticia@ejemplo.test");
        assertThat(user.getDisplayName()).isEqualTo("Ana Ficticia");
        assertThat(user.getPasswordHash()).startsWith("{bcrypt}").doesNotContain(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).isTrue();
    }

    @Test
    void shouldRejectADuplicateEmailInTheSameFirm() {
        TenantContext.runAs(tenantA, () -> userService.createUser("ana@ejemplo.test", "Ana", PASSWORD, Role.OWNER));

        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> userService.createUser("ANA@ejemplo.test", "Ana", PASSWORD, Role.LAWYER)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void shouldAllowTheSameEmailInAnotherFirm() {
        TenantContext.runAs(tenantA, () -> userService.createUser("ana@ejemplo.test", "Ana", PASSWORD, Role.OWNER));
        TenantContext.runAs(tenantB, () -> userService.createUser("ana@ejemplo.test", "Ana", PASSWORD, Role.LAWYER));

        Role roleInB = TenantContext.callAs(tenantB, () -> users.findByEmail("ana@ejemplo.test").orElseThrow().getRole());
        assertThat(roleInB).isEqualTo(Role.LAWYER);
    }

    @Test
    void shouldRejectPasswordsOutsideThePolicy() {
        assertThatThrownBy(() -> UserService.requireAcceptablePassword("corta"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> UserService.requireAcceptablePassword("ñ".repeat(37)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bytes");
        UserService.requireAcceptablePassword("ñ".repeat(36));
    }

    @Test
    void shouldRejectABlankDisplayName() {
        assertThatThrownBy(() -> TenantContext.runAs(tenantA,
                        () -> userService.createUser("sin-nombre@ejemplo.test", "   ", PASSWORD, Role.LAWYER)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }
}
