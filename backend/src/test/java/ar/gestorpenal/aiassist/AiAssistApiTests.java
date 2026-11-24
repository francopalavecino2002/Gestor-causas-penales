package ar.gestorpenal.aiassist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.aiassist.AiAssistUse.Outcome;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.tenancy.TenantContext;
import ar.gestorpenal.tenancy.TenantService;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.Role;
import ar.gestorpenal.user.UserService;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The AI assistance through the real filter chain and database, with a fake provider in place of
 * Gemini: off by default, owner-only switch, per-firm isolation, the draft checked against the firm's
 * catalog, and the usage log.
 */
@SpringBootTest(properties = "app.ai.gemini-api-key=clave-ficticia-de-prueba")
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, AiAssistApiTests.FakeProvider.class})
class AiAssistApiTests {

    private static final String PASSWORD = "clave-ficticia-larga";
    private static final String NOTIFICATION =
            "{\"text\": \"Se fija audiencia de formulación de cargos el 14/03/2035 a las 9:30, Sala 3. Datos ficticios.\"}";

    /** The SPA's double-submit token (see CLAUDE.md, Lessons). */
    private static final RequestPostProcessor CSRF = request -> {
        String token = UUID.randomUUID().toString();
        request.setCookies(new Cookie("XSRF-TOKEN", token));
        request.addHeader("X-XSRF-TOKEN", token);
        return request;
    };

    @TestConfiguration(proxyBeanMethods = false)
    static class FakeProvider {

        @Bean
        @Primary
        FakeReader fakeReader() {
            return new FakeReader();
        }
    }

    /** Answers what the test sets, or fails like a provider over its limit. */
    static class FakeReader implements HearingNotificationReader {

        RawHearingDraft answer;
        boolean busy;

        @Override
        public RawHearingDraft read(String notificationText, List<HearingTypeOption> hearingTypes) {
            if (busy) {
                throw new AiProviderException("over the limit", true);
            }
            return answer;
        }
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TenantService tenants;

    @Autowired
    UserService userService;

    @Autowired
    AiAssistUseRepository uses;

    @Autowired
    FakeReader provider;

    private UUID tenantA;
    private RequestPostProcessor owner;
    private RequestPostProcessor lawyer;
    private RequestPostProcessor paralegal;
    private RequestPostProcessor otherFirmOwner;
    private String caseId;

    @BeforeEach
    void setUp() throws Exception {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        owner = loggedIn(user(tenantA, "titular@ejemplo.test", Role.OWNER));
        lawyer = loggedIn(user(tenantA, "abogado@ejemplo.test", Role.LAWYER));
        paralegal = loggedIn(user(tenantA, "procurador@ejemplo.test", Role.PARALEGAL));
        otherFirmOwner = loggedIn(user(tenantB, "titular@beta.test", Role.OWNER));
        caseId = JsonPath.read(send(owner, post("/api/v1/cases"), """
                {"caption": "Ficticio s/ prueba", "circumscriptionCode": "i-confluencia", "actionType": "public", "represents": "defence"}
                """).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.id");
        provider.busy = false;
        provider.answer = new HearingNotificationReader.RawHearingDraft(
                "formulacion-de-cargos", "2035-03-14", "09:30", null, "Sala 3", null, null);
    }

    @Test
    void shouldBeOffUntilTheOwnerTurnsItOn() throws Exception {
        mockMvc.perform(get("/api/v1/ai-assist").with(lawyer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.provider").value("Google Gemini"));

        draft(lawyer, caseId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/ai-assist-disabled"));
    }

    @Test
    void shouldLetOnlyTheOwnerTurnItOn() throws Exception {
        send(lawyer, put("/api/v1/ai-assist"), "{\"enabled\": true}").andExpect(status().isForbidden());

        send(owner, put("/api/v1/ai-assist"), "{\"enabled\": true}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true));
        mockMvc.perform(get("/api/v1/ai-assist").with(lawyer)).andExpect(jsonPath("$.enabled").value(true));

        send(owner, put("/api/v1/ai-assist"), "{\"enabled\": false}").andExpect(jsonPath("$.enabled").value(false));
        draft(lawyer, caseId).andExpect(status().isConflict());
    }

    @Test
    void shouldRequireTheSwitchValue() throws Exception {
        send(owner, put("/api/v1/ai-assist"), "{}").andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturnADraftCheckedAgainstTheFirmsCatalogAndLogTheUse() throws Exception {
        turnOn(owner);

        draft(lawyer, caseId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.typeCode").value("formulacion-de-cargos"))
                .andExpect(jsonPath("$.date").value("2035-03-14"))
                .andExpect(jsonPath("$.time").value("09:30"))
                .andExpect(jsonPath("$.room").value("Sala 3"))
                .andExpect(jsonPath("$.missing[0]").value("judge"))
                .andExpect(jsonPath("$.missing[1]").value("ofijuReference"));

        List<AiAssistUse> logged = TenantContext.callAs(tenantA, () -> uses.findAllByOrderByUsedAtDesc());
        assertThat(logged).singleElement().satisfies(use -> {
            assertThat(use.getCaseId()).isEqualTo(UUID.fromString(caseId));
            assertThat(use.getOutcome()).isEqualTo(Outcome.SUCCEEDED);
        });
    }

    @Test
    void shouldDropAHearingTypeTheFirmDoesNotOffer() throws Exception {
        turnOn(owner);
        provider.answer = new HearingNotificationReader.RawHearingDraft(
                "audiencia-inventada", "2035-03-14", "09:30", null, null, null, null);

        draft(lawyer, caseId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.typeCode").doesNotExist())
                .andExpect(jsonPath("$.missing[0]").value("typeCode"));
    }

    @Test
    void shouldReportABusyProviderAndLogTheFailure() throws Exception {
        turnOn(owner);
        provider.busy = true;

        draft(lawyer, caseId)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.type").value("/problems/ai-provider-busy"));

        List<AiAssistUse> logged = TenantContext.callAs(tenantA, () -> uses.findAllByOrderByUsedAtDesc());
        assertThat(logged).singleElement().extracting(AiAssistUse::getOutcome).isEqualTo(Outcome.FAILED);
    }

    @Test
    void shouldKeepEachFirmsSwitchAndCasesApart() throws Exception {
        turnOn(owner);

        mockMvc.perform(get("/api/v1/ai-assist").with(otherFirmOwner)).andExpect(jsonPath("$.enabled").value(false));
        draft(otherFirmOwner, caseId).andExpect(status().isConflict());

        turnOn(otherFirmOwner);
        draft(otherFirmOwner, caseId).andExpect(status().isNotFound());
    }

    @Test
    void shouldRejectAnEmptyText() throws Exception {
        turnOn(owner);

        send(lawyer, post("/api/v1/cases/" + caseId + "/hearing-drafts"), "{\"text\": \"  \"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectATextLongerThanTheLimit() throws Exception {
        turnOn(owner);

        send(lawyer, post("/api/v1/cases/" + caseId + "/hearing-drafts"),
                        "{\"text\": \"" + "a".repeat(HearingDraftRequest.TEXT_MAX + 1) + "\"}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldLetAnyMemberWhoSeesTheCaseAskForADraft() throws Exception {
        turnOn(owner);

        draft(paralegal, caseId).andExpect(status().isOk());
    }

    @Test
    void shouldAnswerNotFoundForAnUnknownCase() throws Exception {
        turnOn(owner);

        draft(lawyer, UUID.randomUUID().toString()).andExpect(status().isNotFound());
    }

    @Test
    void shouldLimitTheRequestsOfAFirmPerMinute() throws Exception {
        turnOn(owner);
        for (int i = 0; i < AiAssistService.MAX_REQUESTS_PER_MINUTE; i++) {
            draft(lawyer, caseId).andExpect(status().isOk());
        }

        draft(lawyer, caseId)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.type").value("/problems/ai-assist-rate-limited"));
        draft(otherFirmOwner, caseId).andExpect(status().isConflict());
    }

    private void turnOn(RequestPostProcessor user) throws Exception {
        send(user, put("/api/v1/ai-assist"), "{\"enabled\": true}").andExpect(status().isOk());
    }

    private ResultActions draft(RequestPostProcessor user, String caseId) throws Exception {
        return send(user, post("/api/v1/cases/" + caseId + "/hearing-drafts"), NOTIFICATION);
    }

    private ResultActions send(
            RequestPostProcessor user,
            MockHttpServletRequestBuilder request,
            String body)
            throws Exception {
        return mockMvc.perform(request.with(user).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private AppUser user(UUID tenantId, String email, Role role) {
        return TenantContext.callAs(tenantId, () -> userService.createUser(email, "Persona Ficticia", PASSWORD, role));
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static RequestPostProcessor loggedIn(AppUser user) {
        AuthenticatedUser principal =
                new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(user.getRole().authority()))));
    }
}
