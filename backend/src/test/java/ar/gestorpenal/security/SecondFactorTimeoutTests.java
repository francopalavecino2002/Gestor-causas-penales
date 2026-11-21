package ar.gestorpenal.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

/** With a 1 ms limit, the pending login is already expired when the code arrives. */
@SpringBootTest(properties = "app.security.two-factor.login-timeout=1ms")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SecondFactorTimeoutTests {

    private static final String PASSWORD = "clave-ficticia-larga";
    private static final String EMAIL = "carla@ejemplo.test";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Autowired
    private TwoFactorService twoFactor;

    @Test
    void shouldRejectACodeThatArrivesAfterTheTimeLimit() throws Exception {
        String slug = "plazo-" + UUID.randomUUID().toString().substring(0, 8);
        UUID tenantId = tenants.create("Estudio Ficticio Plazo", slug).id();
        UUID userId = TenantContext.callAs(tenantId,
                () -> userService.createUser(EMAIL, "Carla Ficticia", PASSWORD, Role.PARALEGAL).getId());
        byte[] secret = Base32.decode(TenantContext.callAs(tenantId,
                () -> twoFactor.startEnrollment(userId, PASSWORD).secret()));
        TenantContext.runAs(tenantId, () -> twoFactor.confirmEnrollment(userId, codeAt(secret, 0)));
        Cookie csrf = mockMvc.perform(get(SecurityConfig.CSRF_PATH)).andReturn().getResponse().getCookie("XSRF-TOKEN");

        MockHttpSession session = (MockHttpSession) mockMvc.perform(post(SecurityConfig.LOGIN_PATH)
                        .cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tenant": "%s", "email": "%s", "password": "%s"}""".formatted(slug, EMAIL, PASSWORD)))
                .andExpect(status().isAccepted())
                .andReturn().getRequest().getSession(false);
        assertThat(session).isNotNull();
        Thread.sleep(5);

        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(post(SecurityConfig.SECOND_FACTOR_PATH)
                            .session(session)
                            .cookie(csrf)
                            .header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"code": "%s"}""".formatted(codeAt(secret, 1))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.type").value("/problems/second-factor-expired"));
        }
        assertThat(session.getAttribute(PendingSecondFactor.SESSION_ATTRIBUTE)).isNull();
    }

    private static String codeAt(byte[] secret, int stepsFromNow) {
        return Totp.codeAt(secret, Totp.stepAt(Instant.now()) + stepsFromNow);
    }
}
