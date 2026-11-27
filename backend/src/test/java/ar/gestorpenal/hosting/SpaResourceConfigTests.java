package ar.gestorpenal.hosting;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class SpaResourceConfigTests {

    @ParameterizedTest
    @ValueSource(strings = {"", "/", "causas", "/causas/123", "audiencias/hoy", "/apis-de-terceros"})
    void shouldTreatPathsWithoutAFileNameAsClientRoutes(String path) {
        assertThat(SpaResourceConfig.isClientRoute(path)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"api", "/api/v1/cases", "actuator", "actuator/health", "favicon.ico",
            "assets/index-1234.js", "causas/export.csv"})
    void shouldNotTreatTheApiActuatorOrFilesAsClientRoutes(String path) {
        assertThat(SpaResourceConfig.isClientRoute(path)).isFalse();
    }
}
