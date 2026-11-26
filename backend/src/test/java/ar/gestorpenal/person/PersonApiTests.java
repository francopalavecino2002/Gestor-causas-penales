package ar.gestorpenal.person;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import ar.gestorpenal.audit.AuditAction;
import ar.gestorpenal.audit.AuditEvent;
import ar.gestorpenal.audit.AuditTrail;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Persons, clients and authorized contacts through the real filter chain, against a real database. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PersonApiTests {

    private static final String PASSWORD = "clave-ficticia-larga";

    private static final String CLIENT_JSON = """
            {"intakeDate": "2026-03-10", "referralSource": "Recomendación de otro cliente",
             "consentGivenOn": "2026-03-10", "consentScope": "Tratamiento de datos para la defensa",
             "consentDocumentRef": "Formulario ficticio 001"}
            """;

    private static final String CONTACT_JSON = """
            {"fullName": "Marta Ejemplo", "relationship": "Madre", "phone": "299 000 0000",
             "email": "marta@ejemplo.test", "mayBeTold": "Fechas y lugares de las audiencias"}
            """;

    /**
     * The SPA's double-submit token: the same value in the cookie and the header. Spring Security's
     * {@code csrf()} post-processor is not used because it replaces the token repository of the
     * shared context and breaks the cookie-based login tests that run after this class.
     */
    private static final RequestPostProcessor CSRF = request -> {
        String token = UUID.randomUUID().toString();
        request.setCookies(new Cookie("XSRF-TOKEN", token));
        request.addHeader("X-XSRF-TOKEN", token);
        return request;
    };

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private TenantService tenants;

    @Autowired
    private UserService userService;

    @Autowired
    private AuditTrail auditTrail;

    private UUID tenantA;
    private RequestPostProcessor owner;
    private RequestPostProcessor lawyer;
    private RequestPostProcessor paralegal;
    private RequestPostProcessor otherFirmOwner;

    @BeforeEach
    void createTwoFirms() {
        tenantA = tenants.create("Estudio Ficticio Alfa", uniqueSlug("alfa")).id();
        UUID tenantB = tenants.create("Estudio Ficticio Beta", uniqueSlug("beta")).id();
        owner = loggedIn(TenantContext.callAs(tenantA,
                () -> userService.createUser("titular@ejemplo.test", "Titular Ficticia", PASSWORD, Role.OWNER)));
        lawyer = loggedIn(TenantContext.callAs(tenantA,
                () -> userService.createUser("abogado@ejemplo.test", "Abogado Ficticio", PASSWORD, Role.LAWYER)));
        paralegal = loggedIn(TenantContext.callAs(tenantA,
                () -> userService.createUser("procurador@ejemplo.test", "Procurador Ficticio", PASSWORD, Role.PARALEGAL)));
        otherFirmOwner = loggedIn(TenantContext.callAs(tenantB,
                () -> userService.createUser("titular@beta.test", "Titular Beta Ficticio", PASSWORD, Role.OWNER)));
    }

    @Test
    void shouldCreateAHumanAndALegalPerson() throws Exception {
        mockMvc.perform(post("/api/v1/persons").with(paralegal).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind": "HUMAN", "firstNames": "  Ana  ", "lastNames": "Quiroga Ejemplo",
                                 "aliases": "Anita", "documentType": "DNI", "documentNumber": "30.123.456",
                                 "birthDate": "1990-05-17", "nationality": "Argentina", "phone": "299 000 0000",
                                 "email": "ana@ejemplo.test", "address": "Calle Ficticia 123, Neuquén"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/persons/")))
                .andExpect(jsonPath("$.kind").value("HUMAN"))
                .andExpect(jsonPath("$.displayName").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.firstNames").value("Ana"))
                .andExpect(jsonPath("$.documentType").value("DNI"))
                .andExpect(jsonPath("$.documentNumber").value("30123456"))
                .andExpect(jsonPath("$.archived").value(false));

        mockMvc.perform(post("/api/v1/persons").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind": "LEGAL", "legalName": "Fundación Ejemplo",
                                 "documentType": "CUIT", "documentNumber": "30-70123456-9"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.displayName").value("Fundación Ejemplo"))
                .andExpect(jsonPath("$.documentNumber").value("30701234569"));
    }

    @Test
    void shouldReadAndFullyReplaceAPerson() throws Exception {
        String id = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));

        mockMvc.perform(get("/api/v1/persons/" + id).with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastNames").value("Quiroga Ejemplo"));

        mockMvc.perform(put("/api/v1/persons/" + id).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Ana María", "Quiroga Ejemplo", null, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstNames").value("Ana María"))
                .andExpect(jsonPath("$.documentType").doesNotExist())
                .andExpect(jsonPath("$.documentNumber").doesNotExist());
    }

    @Test
    void shouldRejectInvalidPeopleAsProblemDetails() throws Exception {
        expectInvalid(human("Ana", null, null, null));
        expectInvalid("""
                {"kind": "LEGAL", "legalName": "Fundación Ejemplo", "firstNames": "Ana"}
                """);
        expectInvalid("""
                {"kind": "LEGAL", "legalName": "Fundación Ejemplo", "birthDate": "1990-05-17"}
                """);
        expectInvalid("""
                {"kind": "HUMAN", "firstNames": "Ana", "lastNames": "Quiroga Ejemplo", "legalName": "Ejemplo SA"}
                """);
        expectInvalid(human("Ana", "Quiroga Ejemplo", "DNI", "ABC"));
        expectInvalid(human("Ana", "Quiroga Ejemplo", "CUIL", "30123456"));
        expectInvalid(human("Ana", "Quiroga Ejemplo", "DNI", null));
        expectInvalid(human("Ana", "Quiroga Ejemplo", null, "30123456"));

        mockMvc.perform(post("/api/v1/persons").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kind": "HUMAN", "lastNames": "Quiroga Ejemplo", "email": "no-es-un-correo"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mockMvc.perform(post("/api/v1/persons").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lastNames\": \"Sin tipo\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void theKindOfAPersonShouldNotChange() throws Exception {
        String id = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null));

        mockMvc.perform(put("/api/v1/persons/" + id).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\": \"LEGAL\", \"legalName\": \"Ejemplo SA\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-person-data"));
    }

    @Test
    void shouldKeepOneRecordPerDocumentNumber() throws Exception {
        String existing = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));

        mockMvc.perform(post("/api/v1/persons").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Otra", "Persona Ficticia", "DNI", "30.123.456")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/person-duplicate-document"))
                .andExpect(jsonPath("$.existingPersonId").value(existing));

        String other = createPerson(lawyer, human("Bruno", "Ficticio Ejemplo", "DNI", "28111222"));
        mockMvc.perform(put("/api/v1/persons/" + other).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Bruno", "Ficticio Ejemplo", "DNI", "30 123 456")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.existingPersonId").value(existing));

        mockMvc.perform(put("/api/v1/persons/" + other).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Bruno", "Ficticio Ejemplo", "DNI", "28.111.222")))
                .andExpect(status().isOk());
    }

    @Test
    void shouldSearchByNameAndByFormattedDocumentNumber() throws Exception {
        createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));
        createPerson(lawyer, human("Bruno", "Ficticio Ejemplo", "DNI", "28111222"));
        createPerson(lawyer, "{\"kind\": \"LEGAL\", \"legalName\": \"Fundación Ejemplo\", \"aliases\": \"La Fundación\"}");

        mockMvc.perform(get("/api/v1/persons").param("q", "quiroga").with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].displayName").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.page").value(0));
        mockMvc.perform(get("/api/v1/persons").param("q", "30.123.456").with(paralegal))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].firstNames").value("Ana"));
        mockMvc.perform(get("/api/v1/persons").param("q", "la fundación").with(paralegal))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].kind").value("LEGAL"));
        mockMvc.perform(get("/api/v1/persons").param("q", "ejemplo").with(paralegal))
                .andExpect(jsonPath("$.items", hasSize(3)));
        mockMvc.perform(get("/api/v1/persons").with(paralegal))
                .andExpect(jsonPath("$.items", hasSize(3)));
        mockMvc.perform(get("/api/v1/persons").param("q", "100%").with(paralegal))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void searchShouldBePagedWithAMaximumPageSize() throws Exception {
        for (int i = 0; i < 3; i++) {
            createPerson(lawyer, human("Persona", "Ficticia Numero" + i, null, null));
        }

        mockMvc.perform(get("/api/v1/persons").param("size", "2").param("page", "1").with(paralegal))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.total").value(3));
        mockMvc.perform(get("/api/v1/persons").param("size", "5000").with(paralegal))
                .andExpect(jsonPath("$.size").value(100));
    }

    @Test
    void archivedPeopleShouldLeaveTheDefaultSearchUntilRestored() throws Exception {
        String id = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));

        mockMvc.perform(post("/api/v1/persons/" + id + "/archive").with(lawyer).with(CSRF))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/persons").param("q", "quiroga").with(lawyer))
                .andExpect(jsonPath("$.items", hasSize(0)));
        mockMvc.perform(get("/api/v1/persons").param("q", "quiroga").param("includeArchived", "true").with(lawyer))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].archived").value(true));
        mockMvc.perform(get("/api/v1/persons/" + id).with(lawyer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));

        mockMvc.perform(post("/api/v1/persons/" + id + "/restore").with(owner).with(CSRF))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/persons").param("q", "quiroga").with(lawyer))
                .andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void onlyTheOwnerAndLawyersShouldArchiveOrRestore() throws Exception {
        String id = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null));

        mockMvc.perform(post("/api/v1/persons/" + id + "/archive").with(paralegal).with(CSRF))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("/problems/access-denied"));
        mockMvc.perform(post("/api/v1/persons/" + id + "/restore").with(paralegal).with(CSRF))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/persons/" + id).with(paralegal))
                .andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    void conflictCheckShouldFindADniAsACuilAndTheOtherWayAround() throws Exception {
        String cuilPerson = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "CUIL", "20-30123456-7"));
        String archivedDni = createPerson(lawyer, human("Bruno", "Ficticio Ejemplo", "DNI", "28111222"));
        mockMvc.perform(post("/api/v1/persons/" + archivedDni + "/archive").with(lawyer).with(CSRF))
                .andExpect(status().isNoContent());
        createPerson(lawyer, human("Carla", "Otra Ejemplo", "DNI", "27999888"));
        makeClient(lawyer, cuilPerson);

        conflictCheck(paralegal, "30.123.456")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches", hasSize(1)))
                .andExpect(jsonPath("$.matches[0].personId").value(cuilPerson))
                .andExpect(jsonPath("$.matches[0].displayName").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.matches[0].documentType").value("CUIL"))
                .andExpect(jsonPath("$.matches[0].documentNumber").value("20301234567"))
                .andExpect(jsonPath("$.matches[0].archived").value(false))
                .andExpect(jsonPath("$.matches[0].client").value(true))
                .andExpect(jsonPath("$.disclaimer").value(ConflictCheckResult.DISCLAIMER));

        conflictCheck(paralegal, "27-28111222-4")
                .andExpect(jsonPath("$.matches", hasSize(1)))
                .andExpect(jsonPath("$.matches[0].personId").value(archivedDni))
                .andExpect(jsonPath("$.matches[0].archived").value(true))
                .andExpect(jsonPath("$.matches[0].client").value(false));

        conflictCheck(paralegal, "11222333")
                .andExpect(jsonPath("$.matches", hasSize(0)));
        conflictCheck(paralegal, "  ")
                .andExpect(status().isBadRequest());
    }

    @Test
    void anElevenDigitPassportShouldNotMatchADniByAccident() throws Exception {
        createPerson(lawyer, human("Dario", "Pasaporte Ejemplo", "PASSPORT", "20301234567"));

        conflictCheck(paralegal, "30123456")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches", hasSize(0)));
    }

    @Test
    void aConsentCannotBeDatedInTheFuture() throws Exception {
        String person = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null));

        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intakeDate\": \"2026-01-10\", \"consentGivenOn\": \"2999-01-01\","
                                + " \"consentScope\": \"Gestión de la defensa\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    private ResultActions conflictCheck(RequestPostProcessor user, String documentNumber) throws Exception {
        return mockMvc.perform(post("/api/v1/persons/conflict-check").with(user).with(CSRF)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"documentNumber\": \"" + documentNumber + "\"}"));
    }

    @Test
    void shouldMakeAPersonAClientOnlyOnce() throws Exception {
        String person = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));

        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(paralegal).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CLIENT_JSON))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/clients/")))
                .andExpect(jsonPath("$.person.id").value(person))
                .andExpect(jsonPath("$.person.displayName").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.intakeDate").value("2026-03-10"))
                .andExpect(jsonPath("$.consentScope").value("Tratamiento de datos para la defensa"))
                .andExpect(jsonPath("$.contacts", hasSize(0)))
                .andExpect(jsonPath("$.conflicts", hasSize(0)));

        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CLIENT_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/already-a-client"));
    }

    @Test
    void aClientThatWasArchivedShouldStillBlockANewClientRecord() throws Exception {
        String person = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null));
        String client = makeClient(lawyer, person);

        mockMvc.perform(post("/api/v1/clients/" + client + "/archive").with(lawyer).with(CSRF))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/clients/" + client).with(paralegal))
                .andExpect(jsonPath("$.archived").value(true));
        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CLIENT_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/already-a-client"));

        mockMvc.perform(post("/api/v1/clients/" + client + "/restore").with(owner).with(CSRF))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/clients/" + client).with(paralegal))
                .andExpect(jsonPath("$.archived").value(false));
    }

    @Test
    void onlyTheOwnerAndLawyersShouldArchiveClients() throws Exception {
        String client = makeClient(lawyer, createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null)));

        mockMvc.perform(post("/api/v1/clients/" + client + "/archive").with(paralegal).with(CSRF))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/clients/" + client + "/restore").with(paralegal).with(CSRF))
                .andExpect(status().isForbidden());
    }

    @Test
    void consentDateAndScopeShouldGoTogether() throws Exception {
        String person = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null));

        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intakeDate\": \"2026-03-10\", \"consentGivenOn\": \"2026-03-10\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-person-data"));
        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intakeDate\": \"2026-03-10\", \"consentScope\": \"Tratamiento de datos\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referralSource\": \"Sin fecha de alta\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        String client = makeClient(lawyer, person);
        mockMvc.perform(put("/api/v1/clients/" + client).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intakeDate\": \"2026-03-11\", \"consentScope\": \"Solo alcance\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/v1/clients/" + client).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intakeDate\": \"2026-03-11\", \"referralSource\": \"Derivación\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intakeDate").value("2026-03-11"))
                .andExpect(jsonPath("$.referralSource").value("Derivación"))
                .andExpect(jsonPath("$.consentScope").doesNotExist());
    }

    @Test
    void aClientShouldListOtherPeopleWithTheSameDocument() throws Exception {
        String dni = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));
        String cuil = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "CUIL", "20301234567"));
        String client = makeClient(lawyer, dni);

        mockMvc.perform(get("/api/v1/clients/" + client).with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conflicts", hasSize(1)))
                .andExpect(jsonPath("$.conflicts[0].personId").value(cuil))
                .andExpect(jsonPath("$.conflicts[0].client").value(false));
    }

    @Test
    void shouldAddUpdateAndArchiveAuthorizedContacts() throws Exception {
        String client = makeClient(lawyer, createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null)));

        String location = mockMvc.perform(post("/api/v1/clients/" + client + "/contacts").with(paralegal).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fullName").value("Marta Ejemplo"))
                .andExpect(jsonPath("$.mayBeTold").value("Fechas y lugares de las audiencias"))
                .andReturn().getResponse().getHeader("Location");
        assertThat(location).startsWith("/api/v1/clients/" + client + "/contacts/");

        mockMvc.perform(put(location).with(paralegal).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fullName": "Marta Ejemplo", "relationship": "Tía", "mayBeTold": "Solo fechas"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.relationship").value("Tía"))
                .andExpect(jsonPath("$.phone").doesNotExist());
        mockMvc.perform(get("/api/v1/clients/" + client).with(paralegal))
                .andExpect(jsonPath("$.contacts", hasSize(1)))
                .andExpect(jsonPath("$.contacts[0].mayBeTold").value("Solo fechas"));

        mockMvc.perform(post(location + "/archive").with(paralegal).with(CSRF))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/clients/" + client).with(paralegal))
                .andExpect(jsonPath("$.contacts", hasSize(0)));
    }

    @Test
    void aContactShouldRequireANameAndWhatTheFirmMayTellThem() throws Exception {
        String client = makeClient(lawyer, createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null)));

        mockMvc.perform(post("/api/v1/clients/" + client + "/contacts").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\": \"Marta Ejemplo\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mockMvc.perform(post("/api/v1/clients/" + client + "/contacts").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\": \" \", \"mayBeTold\": \"Todo\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aContactOfAnotherClientShouldNotBeFound() throws Exception {
        String first = makeClient(lawyer, createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null)));
        String second = makeClient(lawyer, createPerson(lawyer, human("Bruno", "Ficticio Ejemplo", null, null)));
        String contactOfFirst = JsonPath.read(mockMvc.perform(post("/api/v1/clients/" + first + "/contacts")
                        .with(lawyer).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(CONTACT_JSON))
                .andReturn().getResponse().getContentAsString(), "$.id");

        mockMvc.perform(put("/api/v1/clients/" + second + "/contacts/" + contactOfFirst).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.type").value("/problems/not-found"));
        mockMvc.perform(post("/api/v1/clients/" + second + "/contacts/" + contactOfFirst + "/archive")
                        .with(lawyer).with(CSRF))
                .andExpect(status().isNotFound());
    }

    @Test
    void aFirmShouldNeverSeeOrChangeAnotherFirmsRecords() throws Exception {
        String person = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));
        String client = makeClient(lawyer, person);
        String contact = JsonPath.read(mockMvc.perform(post("/api/v1/clients/" + client + "/contacts")
                        .with(lawyer).with(CSRF).contentType(MediaType.APPLICATION_JSON).content(CONTACT_JSON))
                .andReturn().getResponse().getContentAsString(), "$.id");

        mockMvc.perform(get("/api/v1/persons/" + person).with(otherFirmOwner)).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/persons/" + person).with(otherFirmOwner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Robada", "Ejemplo", null, null)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/persons/" + person + "/archive").with(otherFirmOwner).with(CSRF))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/persons/" + person + "/client").with(otherFirmOwner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CLIENT_JSON))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/clients/" + client).with(otherFirmOwner)).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/clients/" + client).with(otherFirmOwner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CLIENT_JSON))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/clients/" + client + "/archive").with(otherFirmOwner).with(CSRF))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/clients/" + client + "/contacts").with(otherFirmOwner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_JSON))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/clients/" + client + "/contacts/" + contact).with(otherFirmOwner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CONTACT_JSON))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/persons").param("q", "quiroga").param("includeArchived", "true").with(otherFirmOwner))
                .andExpect(jsonPath("$.items", hasSize(0)));
        conflictCheck(otherFirmOwner, "30123456")
                .andExpect(jsonPath("$.matches", hasSize(0)));

        // The same document is free in the other firm: one record per document is per firm.
        mockMvc.perform(post("/api/v1/persons").with(otherFirmOwner).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Ana", "Quiroga Ejemplo", "DNI", "30123456")))
                .andExpect(status().isCreated());
    }

    @Test
    void theOverviewShouldShowTheClientAndStayInsideTheFirm() throws Exception {
        String person = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "99123456"));

        mockMvc.perform(get("/api/v1/persons/" + person + "/overview").with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.clientId").doesNotExist())
                .andExpect(jsonPath("$.caseRoles", hasSize(0)));

        String client = makeClient(lawyer, person);
        mockMvc.perform(get("/api/v1/persons/" + person + "/overview").with(paralegal))
                .andExpect(jsonPath("$.clientId").value(client));
        mockMvc.perform(get("/api/v1/persons").param("q", "99.123.456").with(paralegal))
                .andExpect(jsonPath("$.items[0].clientId").value(client))
                .andExpect(jsonPath("$.items[0].caseRoles", hasSize(0)));

        mockMvc.perform(get("/api/v1/persons/" + person + "/overview").with(otherFirmOwner))
                .andExpect(status().isNotFound());
    }

    @Test
    void anArchivedPersonShouldCarryTheirClientInTheListOnlyWhenArchivedAreIncluded() throws Exception {
        String person = createPerson(lawyer, human("Bruno", "Archivado Ejemplo", null, null));
        String client = makeClient(lawyer, person);
        mockMvc.perform(post("/api/v1/persons/" + person + "/archive").with(lawyer).with(CSRF))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/persons").param("q", "archivado").with(lawyer))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.total").value(0));
        mockMvc.perform(get("/api/v1/persons").param("q", "archivado").param("includeArchived", "true").with(lawyer))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].archived").value(true))
                .andExpect(jsonPath("$.items[0].clientId").value(client));
    }

    @Test
    void shouldRejectAnonymousRequestsAndRequestsWithoutCsrfToken() throws Exception {
        mockMvc.perform(get("/api/v1/persons"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mockMvc.perform(get("/api/v1/clients/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/persons").with(lawyer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Ana", "Quiroga Ejemplo", null, null)))
                .andExpect(status().isForbidden());
    }

    @Test
    void nothingShouldBeDeletable() throws Exception {
        String person = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", null, null));
        String client = makeClient(lawyer, person);

        mockMvc.perform(delete("/api/v1/persons/" + person).with(owner).with(CSRF))
                .andExpect(status().is4xxClientError());
        mockMvc.perform(delete("/api/v1/clients/" + client).with(owner).with(CSRF))
                .andExpect(status().is4xxClientError());

        mockMvc.perform(get("/api/v1/persons/" + person).with(owner)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/clients/" + client).with(owner)).andExpect(status().isOk());
    }

    @Test
    void creatingUpdatingAndArchivingAPersonShouldLeaveAHistory() throws Exception {
        String id = createPerson(lawyer, human("Ana", "Quiroga Ejemplo", "DNI", "30123456"));
        mockMvc.perform(put("/api/v1/persons/" + id).with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(human("Ana María", "Quiroga Ejemplo", "DNI", "30123456")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/persons/" + id + "/archive").with(lawyer).with(CSRF))
                .andExpect(status().isNoContent());

        List<AuditEvent> history = TenantContext.callAs(tenantA,
                () -> auditTrail.historyOf(Person.class, UUID.fromString(id)));

        assertThat(history).extracting(AuditEvent::getAction)
                .containsExactly(AuditAction.CREATE, AuditAction.UPDATE, AuditAction.ARCHIVE);
        assertThat(history.get(1).getChanges()).anySatisfy(change -> {
            assertThat(change.field()).isEqualTo("firstNames");
            assertThat(change.newValue()).isEqualTo("Ana María");
        });
    }

    private void expectInvalid(String json) throws Exception {
        mockMvc.perform(post("/api/v1/persons").with(lawyer).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("/problems/invalid-person-data"));
    }

    private String createPerson(RequestPostProcessor user, String json) throws Exception {
        String body = mockMvc.perform(post("/api/v1/persons").with(user).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private String makeClient(RequestPostProcessor user, String personId) throws Exception {
        String body = mockMvc.perform(post("/api/v1/persons/" + personId + "/client").with(user).with(CSRF)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CLIENT_JSON))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private static String human(String firstNames, String lastNames, String documentType, String documentNumber) {
        return """
                {"kind": "HUMAN", "firstNames": %s, "lastNames": %s, "documentType": %s, "documentNumber": %s}
                """.formatted(quoted(firstNames), quoted(lastNames), quoted(documentType), quoted(documentNumber));
    }

    private static String quoted(String value) {
        return value == null ? "null" : "\"" + value + "\"";
    }

    private static String uniqueSlug(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static RequestPostProcessor loggedIn(AppUser user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getTenantId(), user.getRole(), Instant.now());
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                principal, null, List.of(new SimpleGrantedAuthority(user.getRole().authority()))));
    }
}
