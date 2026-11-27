package ar.gestorpenal.hosting;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The frontend served by the backend (ADR-0046), with the stand-in build of
 * {@code src/test/resources/static/}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SpaFrontendTests {

    private static final String SHELL = "spa-test-shell";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldServeTheShellAtTheRootWithoutLogin() throws Exception {
        // Spring Boot's welcome page forwards "/" to index.html; MockMvc does not follow forwards.
        mockMvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("index.html"));
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString(SHELL)));
    }

    @Test
    void shouldServeTheShellForAClientRouteSoAReloadWorks() throws Exception {
        mockMvc.perform(get("/causas/123"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString(SHELL)))
                .andExpect(header().string("Cache-Control", containsString("no-cache")));
    }

    @Test
    void shouldServeHashedAssetsWithALongCache() throws Exception {
        mockMvc.perform(get("/assets/index-test1234.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("spa-test-bundle")))
                .andExpect(header().string("Cache-Control", "max-age=31536000, public, immutable"));
    }

    @Test
    void shouldAnswerAMissingFileWithNotFoundInsteadOfTheShell() throws Exception {
        mockMvc.perform(get("/assets/missing-1234.js"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/logo-missing.png"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldKeepTheApiProtectedAndNeverAnswerItWithTheShell() throws Exception {
        mockMvc.perform(get("/api/v1/cases"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldNotOpenTheApiThroughAnEncodedPath() throws Exception {
        mockMvc.perform(get(URI.create("/%61pi/v1/cases")))
                .andExpect(status().is4xxClientError())
                .andExpect(content().string(not(containsString(SHELL))));
    }

    @Test
    void shouldNotAllowCrossOriginRequests() throws Exception {
        mockMvc.perform(options("/api/v1/cases")
                        .header("Origin", "https://otro-sitio.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
