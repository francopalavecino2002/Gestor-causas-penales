package ar.gestorpenal.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserRepository;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

/**
 * The {@code bootstrap} profile as the operator runs it (T66): the values come from the
 * {@code BOOTSTRAP_*} variables, there is no web server, and the firm exists once the application
 * has started. The output is captured from before the context starts, so it holds the runner's lines.
 */
@SpringBootTest(
        webEnvironment = WebEnvironment.NONE,
        properties = {
            "BOOTSTRAP_FIRM_NAME=Estudio Ficticio Inicial",
            "BOOTSTRAP_FIRM_SLUG=estudio-inicial",
            "BOOTSTRAP_OWNER_EMAIL=titular@ejemplo.test",
            "BOOTSTRAP_OWNER_NAME=Titular Ficticio"
        })
@ActiveProfiles("bootstrap")
@Import(EmptyDatabaseConfiguration.class)
@ExtendWith(OutputCaptureExtension.class)
class FirstFirmBootstrapRunnerTests {

    private static final Pattern TEMPORARY_PASSWORD = Pattern.compile("Contraseña temporal: (\\S+)");

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private FirstFirmBootstrap bootstrap;

    @Autowired
    private FirstFirmRequest request;

    @Test
    void shouldCreateTheFirmAtStartupAndPrintTheTemporaryPasswordOnceOutsideTheLog(CapturedOutput output) {
        UUID firmId = tenants.findActiveIdBySlug("estudio-inicial").orElseThrow();

        Matcher printed = TEMPORARY_PASSWORD.matcher(output.getOut());
        assertThat(printed.find()).as("the temporary password is printed").isTrue();
        String temporaryPassword = printed.group(1);
        assertThat(printed.find()).as("the temporary password is printed once").isFalse();
        // getAll() also holds the log lines (console appender): the password is in none of them.
        assertThat(output.getAll().split(Pattern.quote(temporaryPassword), -1))
                .as("the temporary password appears only on the console line")
                .hasSize(2);
        assertThat(output.getOut()).contains("Estudio creado: estudio-inicial", "Titular: titular@ejemplo.test");

        TenantContext.runAs(firmId, () -> {
            AppUser owner = users.findByEmail("titular@ejemplo.test").orElseThrow();
            assertThat(owner.getRole()).isEqualTo(Role.OWNER);
            assertThat(owner.getDisplayName()).isEqualTo("Titular Ficticio");
            assertThat(owner.isPasswordChangeRequired()).isTrue();
            assertThat(passwordEncoder.matches(temporaryPassword, owner.getPasswordHash())).isTrue();
        });
    }

    @Test
    void shouldFailASecondRunAndPrintNothing() {
        ByteArrayOutputStream console = new ByteArrayOutputStream();
        FirstFirmBootstrapRunner secondRun = new FirstFirmBootstrapRunner(
                bootstrap, request, new PrintStream(console, true, StandardCharsets.UTF_8));

        assertThatThrownBy(() -> secondRun.run(null)).isInstanceOf(FirmAlreadyExistsException.class);
        assertThat(console.toString(StandardCharsets.UTF_8)).isEmpty();
    }
}
