package ar.gestorpenal.casefile;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/** A firm never sees or touches another firm's cases, people or users. */
class CaseTenantIsolationTests extends CaseApiTestSupport {

    @Test
    void aCaseOfAnotherFirmShouldBeNotFoundAndAbsentFromItsList() throws Exception {
        String id = createCase(lawyer, caseJson("Caso de la firma alfa", ", \"mpfLegajo\": \"MPFNQ 555/2021\""));
        String person = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String defendant = addDefendant(lawyer, id, "{\"personId\": \"" + person + "\"}");

        mockMvc.perform(get("/api/v1/cases/" + id).with(otherFirmOwner)).andExpect(status().isNotFound());
        putJson(otherFirmOwner, "/api/v1/cases/" + id, caseJson("Robado", "")).andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, "/api/v1/cases/" + id + "/archive").andExpect(status().isNotFound());
        putJson(otherFirmOwner, "/api/v1/cases/" + id + "/team", teamOf(otherFirmOwnerId))
                .andExpect(status().isNotFound());
        putJson(otherFirmOwner, "/api/v1/cases/" + id + "/defendants/" + defendant, "{}")
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/cases").param("includeArchived", "true").with(otherFirmOwner))
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items", hasSize(0)));
        mockMvc.perform(get("/api/v1/cases").param("q", "MPFNQ555/2021").with(otherFirmOwner))
                .andExpect(jsonPath("$.total").value(0));

        // The same legajo is free in the other firm: numbers are unique per firm.
        postJson(otherFirmOwner, "/api/v1/cases", caseJson("Caso de la firma beta", ", \"mpfLegajo\": \"MPFNQ 555/2021\""))
                .andExpect(status().isCreated());
    }

    @Test
    void aFirmCannotAttachAnotherFirmsPersonOrUser() throws Exception {
        String foreignPerson = createPerson(lawyer, humanJson("Ana", "Quiroga Ejemplo", null));
        String ownCase = createCase(otherFirmOwner, caseJson("Caso de la firma beta", ""));

        postJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/defendants", "{\"personId\": \"" + foreignPerson + "\"}")
                .andExpect(status().isNotFound());
        postJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/parties",
                "{\"personId\": \"" + foreignPerson + "\", \"roleCode\": \"testigo\"}")
                .andExpect(status().isNotFound());
        postJson(otherFirmOwner, "/api/v1/cases", caseJson("Con responsable ajeno", ", \"responsibleUserId\": \"" + lawyerId + "\""))
                .andExpect(status().isNotFound());
        putJson(otherFirmOwner, "/api/v1/cases/" + ownCase + "/team", teamOf(lawyerId))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/cases/" + ownCase).with(otherFirmOwner))
                .andExpect(jsonPath("$.defendants", hasSize(0)))
                .andExpect(jsonPath("$.parties", hasSize(0)))
                .andExpect(jsonPath("$.team", hasSize(1)));
    }

    private static String teamOf(java.util.UUID userId) {
        return "{\"members\": [{\"userId\": \"" + userId + "\", \"role\": \"RESPONSIBLE\"}]}";
    }
}
