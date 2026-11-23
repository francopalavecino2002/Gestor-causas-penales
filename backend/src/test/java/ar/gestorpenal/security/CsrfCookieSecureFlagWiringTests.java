package ar.gestorpenal.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/** The LAN demo (ADR-0029) turns Secure off through the session-cookie property alone. */
@SpringBootTest(properties = "server.servlet.session.cookie.secure=false")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CsrfCookieSecureFlagWiringTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldDropSecureOnTheCsrfCookieWhenTheSessionCookieIsNotSecure() throws Exception {
        mockMvc.perform(get(SecurityConfig.CSRF_PATH))
                .andExpect(status().isNoContent())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(cookie().secure("XSRF-TOKEN", false));
    }
}
