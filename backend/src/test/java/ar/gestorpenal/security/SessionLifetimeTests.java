package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** With a 1 ms absolute lifetime, a session is already expired on its next request. */
@SpringBootTest(properties = "app.security.session.max-age=1ms")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SessionLifetimeTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Test
    void shouldEndASessionOlderThanItsAbsoluteLifetime() throws Exception {
        String slug = "vida-" + UUID.randomUUID().toString().substring(0, 8);
        UUID tenantId = tenants.create("Estudio Ficticio Vida", slug).id();
        TenantContext.runAs(tenantId,
                () -> userService.createUser("luis@ejemplo.test", "Luis Ficticio", "clave-ficticia-larga", Role.LAWYER));
        Cookie csrf = mockMvc.perform(get(SecurityConfig.CSRF_PATH)).andReturn().getResponse().getCookie("XSRF-TOKEN");

        MvcResult login = mockMvc.perform(post(SecurityConfig.LOGIN_PATH)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tenant": "%s", "email": "luis@ejemplo.test", "password": "clave-ficticia-larga"}"""
                                .formatted(slug)))
                .andExpect(status().isNoContent())
                .andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        Thread.sleep(5);

        mockMvc.perform(get("/api/v1/me").session(session)).andExpect(status().isUnauthorized());
        assertThat(session.isInvalid()).isTrue();
    }
}
