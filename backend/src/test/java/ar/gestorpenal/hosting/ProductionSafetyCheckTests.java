package ar.gestorpenal.hosting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionSafetyCheckTests {

    private static MockEnvironment production() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("server.servlet.session.cookie.secure", "true")
                .withProperty("spring.jpa.hibernate.ddl-auto", "validate")
                .withProperty("app.security.two-factor.encryption-key", "cHJvZHVjdGlvbi1rZXktZm9yLXRoZS10ZXN0cyEhIQ==");
        environment.setActiveProfiles("prod");
        return environment;
    }

    @Test
    void shouldAcceptASafeProductionEnvironment() {
        assertThat(ProductionSafetyCheck.problems(production())).isEmpty();
    }

    @Test
    void shouldRejectTheDemoOrDevProfileNextToProd() {
        MockEnvironment environment = production();
        environment.setActiveProfiles("prod", "demo", "dev");

        assertThat(ProductionSafetyCheck.problems(environment))
                .containsExactlyInAnyOrder("profile 'demo' is active", "profile 'dev' is active");
    }

    @Test
    void shouldRejectCookiesWithoutSecure() {
        MockEnvironment environment = production().withProperty("server.servlet.session.cookie.secure", "false");

        assertThat(ProductionSafetyCheck.problems(environment)).containsExactly("session cookies are not Secure");
    }

    @Test
    void shouldRejectHibernateChangingTheSchema() {
        MockEnvironment environment = production().withProperty("spring.jpa.hibernate.ddl-auto", "update");

        assertThat(ProductionSafetyCheck.problems(environment))
                .containsExactly("spring.jpa.hibernate.ddl-auto is 'update' (only Flyway changes the schema)");
    }

    @Test
    void shouldRejectTheDevelopmentTotpKey() {
        MockEnvironment environment = production()
                .withProperty("app.security.two-factor.encryption-key", ProductionSafetyCheck.DEV_TOTP_KEY);

        assertThat(ProductionSafetyCheck.problems(environment)).containsExactly("TOTP_ENCRYPTION_KEY is the development key");
    }

    @Test
    void shouldRejectEmailLinksWithoutHttpsOnceMailIsSent() {
        MockEnvironment environment = production()
                .withProperty("app.mail.smtp.host", "smtp.ejemplo.test")
                .withProperty("app.public-url", "http://localhost:5173");

        assertThat(ProductionSafetyCheck.problems(environment))
                .containsExactly("MAIL_SMTP_HOST is set but APP_PUBLIC_URL is not an https:// address");
    }

    @Test
    void shouldAcceptHttpsEmailLinksOrNoMailAtAll() {
        assertThat(ProductionSafetyCheck.problems(production()
                        .withProperty("app.mail.smtp.host", "smtp.ejemplo.test")
                        .withProperty("app.public-url", "https://gestor.ejemplo.test")))
                .isEmpty();
        assertThat(ProductionSafetyCheck.problems(production().withProperty("app.public-url", "http://localhost:5173")))
                .isEmpty();
    }

    @Test
    void shouldFailTheStartupWhenSomethingIsUnsafe() {
        MockEnvironment environment = production().withProperty("server.servlet.session.cookie.secure", "false");

        assertThatThrownBy(() -> new ProductionSafetyCheck(environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("session cookies are not Secure");
    }
}
