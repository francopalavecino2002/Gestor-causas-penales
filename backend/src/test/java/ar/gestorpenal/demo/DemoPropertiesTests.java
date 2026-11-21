package ar.gestorpenal.demo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/** The demo password is checked at startup, before the seeder writes anything. */
class DemoPropertiesTests {

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(DemoPropertiesConfig.class);

    @Test
    void shouldFailToStartWithoutAPassword() {
        runner.run(context -> assertThat(context).hasFailed());
    }

    @Test
    void shouldFailToStartWithABlankPassword() {
        runner.withPropertyValues("app.demo.password=   ").run(context -> assertThat(context).hasFailed());
    }

    @Test
    void shouldFailToStartWithAPasswordShorterThanTwelveCharacters() {
        runner.withPropertyValues("app.demo.password=corta-1234").run(context -> assertThat(context).hasFailed());
    }

    @Test
    void shouldBindAValidPasswordAndNeverPrintIt() {
        runner.withPropertyValues("app.demo.password=clave-demo-ficticia").run(context -> {
            DemoProperties properties = context.getBean(DemoProperties.class);
            assertThat(properties.password()).isEqualTo("clave-demo-ficticia");
            assertThat(properties.toString()).doesNotContain("clave-demo-ficticia");
        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(DemoProperties.class)
    static class DemoPropertiesConfig {}
}
