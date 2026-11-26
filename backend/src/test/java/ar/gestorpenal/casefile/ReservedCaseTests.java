package ar.gestorpenal.casefile;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Reserved cases: only the team and the owner see them; for everybody else they do not exist. */
class ReservedCaseTests extends CaseApiTestSupport {

    private static final String RESERVED = ", \"reserved\": true";

    @Test
    void aReservedCaseShouldNotExistForALawyerOutsideTheTeam() throws Exception {
        String id = createCase(lawyer, caseJson("Caso reservado ficticio", RESERVED));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String defendant = addDefendant(lawyer, id, "{\"personId\": \"" + person + "\"}");

        mockMvc.perform(get("/api/v1/cases/" + id).with(otherLawyer)).andExpect(status().isNotFound());
        putJson(otherLawyer, "/api/v1/cases/" + id, caseJson("Robado", "")).andExpect(status().isNotFound());
        postEmpty(otherLawyer, "/api/v1/cases/" + id + "/archive").andExpect(status().isNotFound());
        postEmpty(otherLawyer, "/api/v1/cases/" + id + "/restore").andExpect(status().isNotFound());
        putJson(otherLawyer, "/api/v1/cases/" + id + "/team", teamJson(otherLawyerId, "RESPONSIBLE"))
                .andExpect(status().isNotFound());
        postJson(otherLawyer, "/api/v1/cases/" + id + "/defendants", "{\"personId\": \"" + person + "\"}")
                .andExpect(status().isNotFound());
        putJson(otherLawyer, "/api/v1/cases/" + id + "/defendants/" + defendant, "{}")
                .andExpect(status().isNotFound());
        postEmpty(otherLawyer, "/api/v1/cases/" + id + "/defendants/" + defendant + "/archive")
                .andExpect(status().isNotFound());
        postJson(otherLawyer, "/api/v1/cases/" + id + "/defendants/" + defendant + "/charges", "{\"offence\": \"X\"}")
                .andExpect(status().isNotFound());
        postJson(otherLawyer, "/api/v1/cases/" + id + "/parties",
                "{\"personId\": \"" + person + "\", \"roleCode\": \"testigo\"}")
                .andExpect(status().isNotFound());
    }

    @Test
    void aReservedCaseShouldBeAbsentFromListAndSearchWithACorrectTotal() throws Exception {
        createCase(lawyer, caseJson("Caso reservado ficticio", RESERVED));
        createCase(lawyer, caseJson("Caso abierto ficticio", ""));

        mockMvc.perform(get("/api/v1/cases").with(otherLawyer))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].caption").value("Caso abierto ficticio"));
        mockMvc.perform(get("/api/v1/cases").param("q", "reservado").with(otherLawyer))
                .andExpect(jsonPath("$.total").value(0));
        mockMvc.perform(get("/api/v1/cases").with(lawyer)).andExpect(jsonPath("$.total").value(2));
        mockMvc.perform(get("/api/v1/cases").with(owner)).andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void theOwnerAndTeamMembersShouldSeeAReservedCase() throws Exception {
        String id = createCase(lawyer, caseJson("Caso reservado ficticio", RESERVED));

        mockMvc.perform(get("/api/v1/cases/" + id).with(owner)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/cases/" + id).with(paralegal)).andExpect(status().isNotFound());

        putJson(lawyer, "/api/v1/cases/" + id + "/team",
                "{\"members\": [{\"userId\": \"" + lawyerId + "\", \"role\": \"RESPONSIBLE\"},"
                        + " {\"userId\": \"" + paralegalId + "\", \"role\": \"PARALEGAL\"}]}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.team", hasSize(2)));

        mockMvc.perform(get("/api/v1/cases/" + id).with(paralegal)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/cases").with(paralegal)).andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void aCreatorWhoIsNotTheResponsibleShouldStayOnTheirReservedCase() throws Exception {
        String id = createCase(paralegal, caseJson("Caso reservado por procurador",
                RESERVED + ", \"responsibleUserId\": \"" + lawyerId + "\""));

        mockMvc.perform(get("/api/v1/cases/" + id).with(paralegal))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.team", hasSize(2)));
    }

    @Test
    void onlyTheOwnerOrTheResponsibleShouldChangeTheTeamOrTheReservedFlag() throws Exception {
        String id = createCase(lawyer, caseJson("Caso compartido ficticio", ""));
        putJson(lawyer, "/api/v1/cases/" + id + "/team",
                "{\"members\": [{\"userId\": \"" + lawyerId + "\", \"role\": \"RESPONSIBLE\"},"
                        + " {\"userId\": \"" + otherLawyerId + "\", \"role\": \"COLLABORATOR\"}]}")
                .andExpect(status().isOk());

        putJson(otherLawyer, "/api/v1/cases/" + id + "/team", teamJson(otherLawyerId, "RESPONSIBLE"))
                .andExpect(status().isForbidden());
        putJson(paralegal, "/api/v1/cases/" + id + "/team", teamJson(paralegalId, "RESPONSIBLE"))
                .andExpect(status().isForbidden());
        putJson(otherLawyer, "/api/v1/cases/" + id, caseJson("Caso compartido ficticio", RESERVED))
                .andExpect(status().isForbidden());

        putJson(lawyer, "/api/v1/cases/" + id, caseJson("Caso compartido ficticio", RESERVED))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reserved").value(true));
        putJson(owner, "/api/v1/cases/" + id + "/team", teamJson(otherLawyerId, "RESPONSIBLE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.team", hasSize(1)))
                .andExpect(jsonPath("$.team[0].userId").value(otherLawyerId.toString()));
    }

    @Test
    void anUpdateWithoutTheReservedFlagShouldKeepItAndBeAllowedToACollaborator() throws Exception {
        String id = createCase(lawyer, caseJson("Caso reservado ficticio", RESERVED));
        putJson(lawyer, "/api/v1/cases/" + id + "/team",
                "{\"members\": [{\"userId\": \"" + lawyerId + "\", \"role\": \"RESPONSIBLE\"},"
                        + " {\"userId\": \"" + otherLawyerId + "\", \"role\": \"COLLABORATOR\"}]}")
                .andExpect(status().isOk());

        putJson(otherLawyer, "/api/v1/cases/" + id, caseJson("Caso reservado renombrado", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caption").value("Caso reservado renombrado"))
                .andExpect(jsonPath("$.reserved").value(true));
    }

    @Test
    void aDuplicateNumberInAReservedCaseShouldNotRevealItsId() throws Exception {
        String reserved = createCase(lawyer, caseJson("Caso reservado ficticio",
                RESERVED + ", \"mpfLegajo\": \"MPFNQ 4321/2026\""));

        postJson(otherLawyer, "/api/v1/cases", caseJson("Otro caso", ", \"mpfLegajo\": \"mpfnq4321/2026\""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/case-duplicate-legajo"))
                .andExpect(jsonPath("$.existingCaseId").doesNotExist())
                .andExpect(content().string(not(containsString(reserved))));
        postJson(lawyer, "/api/v1/cases", caseJson("Otro caso", ", \"mpfLegajo\": \"MPFNQ 4321/2026\""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.existingCaseId").value(reserved));
    }

    @Test
    void aTeamNeedsExactlyOneResponsibleWhoIsAnOwnerOrLawyer() throws Exception {
        String id = createCase(lawyer, caseJson("Caso para equipo", ""));

        putJson(lawyer, "/api/v1/cases/" + id + "/team", teamJson(lawyerId, "COLLABORATOR"))
                .andExpect(status().isBadRequest());
        putJson(lawyer, "/api/v1/cases/" + id + "/team",
                "{\"members\": [{\"userId\": \"" + lawyerId + "\", \"role\": \"RESPONSIBLE\"},"
                        + " {\"userId\": \"" + otherLawyerId + "\", \"role\": \"RESPONSIBLE\"}]}")
                .andExpect(status().isBadRequest());
        putJson(lawyer, "/api/v1/cases/" + id + "/team", teamJson(paralegalId, "RESPONSIBLE"))
                .andExpect(status().isBadRequest());
        putJson(lawyer, "/api/v1/cases/" + id + "/team", "{\"members\": []}")
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/cases/" + id).with(lawyer))
                .andExpect(jsonPath("$.team", hasSize(1)))
                .andExpect(jsonPath("$.team[0].userId").value(lawyerId.toString()));
    }

    @Test
    void theConflictCheckShouldHideTheCaptionOfAReservedCaseFromANonMember() throws Exception {
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", "30123456"));
        String reserved = createCase(lawyer, caseJson("Caso reservado ficticio", RESERVED));
        String open = createCase(lawyer, caseJson("Caso abierto ficticio", ""));
        addDefendant(lawyer, reserved, "{\"personId\": \"" + person + "\"}");
        postJson(lawyer, "/api/v1/cases/" + open + "/parties",
                "{\"personId\": \"" + person + "\", \"roleCode\": \"testigo\"}").andExpect(status().isCreated());

        conflictCheck(lawyer, "30123456")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches[0].caseRoles", hasSize(2)))
                .andExpect(jsonPath("$.matches[0].caseRoles[?(@.caseId == '" + reserved + "')].caption")
                        .value("Caso reservado ficticio"))
                .andExpect(jsonPath("$.matches[0].caseRoles[?(@.caseId == '" + reserved + "')].roleCode")
                        .value("imputado"))
                .andExpect(jsonPath("$.matches[0].caseRoles[?(@.caseId == '" + open + "')].roleName")
                        .value("Testigo"));

        conflictCheck(otherLawyer, "30123456")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches[0].caseRoles", hasSize(2)))
                .andExpect(jsonPath("$.matches[0].caseRoles[?(@.reserved == true)]", hasSize(1)))
                .andExpect(jsonPath("$.matches[0].caseRoles[?(@.reserved == true)].roleCode").value("imputado"))
                .andExpect(content().string(not(containsString(reserved))))
                .andExpect(content().string(not(containsString("Caso reservado ficticio"))))
                .andExpect(jsonPath("$.matches[0].caseRoles[?(@.caseId == '" + open + "')].caption")
                        .value("Caso abierto ficticio"));
    }

    @Test
    void thePersonListAndOverviewShouldShowRolesInCasesMaskingReservedOnes() throws Exception {
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", "99123456"));
        String reserved = createCase(lawyer, caseJson("Caso reservado ficticio", RESERVED));
        String open = createCase(lawyer, caseJson("Caso abierto ficticio", ""));
        addDefendant(lawyer, reserved, "{\"personId\": \"" + person + "\"}");
        postJson(lawyer, "/api/v1/cases/" + open + "/parties",
                "{\"personId\": \"" + person + "\", \"roleCode\": \"testigo\"}").andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/persons").param("q", "quiroga").with(lawyer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(person))
                .andExpect(jsonPath("$.items[0].displayName").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.items[0].clientId").doesNotExist())
                .andExpect(jsonPath("$.items[0].caseRoles", hasSize(2)));

        mockMvc.perform(get("/api/v1/persons/" + person + "/overview").with(otherLawyer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(person))
                .andExpect(jsonPath("$.documentNumber").value("99123456"))
                .andExpect(jsonPath("$.caseRoles", hasSize(2)))
                .andExpect(jsonPath("$.caseRoles[?(@.reserved == true)].roleCode").value("imputado"))
                .andExpect(jsonPath("$.caseRoles[?(@.caseId == '" + open + "')].roleName").value("Testigo"))
                .andExpect(content().string(not(containsString(reserved))))
                .andExpect(content().string(not(containsString("Caso reservado ficticio"))));

        String client = JsonPath.read(postJson(lawyer, "/api/v1/persons/" + person + "/client",
                        "{\"intakeDate\": \"2026-03-10\"}")
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(), "$.id");
        mockMvc.perform(get("/api/v1/persons/" + person + "/overview").with(lawyer))
                .andExpect(jsonPath("$.clientId").value(client));
        mockMvc.perform(get("/api/v1/persons/" + UUID.randomUUID() + "/overview").with(lawyer))
                .andExpect(status().isNotFound());
    }

    private static String teamJson(UUID userId, String role) {
        return "{\"members\": [{\"userId\": \"" + userId + "\", \"role\": \"" + role + "\"}]}";
    }

    private ResultActions conflictCheck(RequestPostProcessor user, String documentNumber) throws Exception {
        return mockMvc.perform(post("/api/v1/persons/conflict-check").with(user).with(CSRF)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"documentNumber\": \"" + documentNumber + "\"}"));
    }
}
