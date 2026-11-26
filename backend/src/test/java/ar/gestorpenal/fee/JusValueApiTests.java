package ar.gestorpenal.fee;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The firm's JUS values: who enters them, what they must look like and how they are archived. */
class JusValueApiTests extends FeeApiTestSupport {

    private static final String NO_SUCH_VALUE = "00000000-0000-0000-0000-000000000001";

    @Test
    void shouldLetTheOwnerAndLawyersEnterAValue() throws Exception {
        postJson(owner, JUS_VALUES, "{\"value\": 94963.25, \"validFrom\": \"2026-07-01\"}")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/fees/jus-values/")))
                .andExpect(jsonPath("$.value").value(94963.25))
                .andExpect(jsonPath("$.validFrom").value("2026-07-01"))
                .andExpect(jsonPath("$.archived").value(false));
        postJson(lawyer, JUS_VALUES, "{\"value\": 100000, \"validFrom\": \"2026-09-01\"}")
                .andExpect(status().isCreated());
    }

    @Test
    void shouldKeepParalegalsAndAdministrativeStaffFromChangingValues() throws Exception {
        String id = createJusValue(owner, "1000", "2026-01-01");

        postJson(paralegal, JUS_VALUES, "{\"value\": 1000, \"validFrom\": \"2026-02-01\"}")
                .andExpect(status().isForbidden());
        postJson(adminStaff, JUS_VALUES, "{\"value\": 1000, \"validFrom\": \"2026-02-01\"}")
                .andExpect(status().isForbidden());
        postEmpty(paralegal, JUS_VALUES + "/" + id + "/archive").andExpect(status().isForbidden());
        postEmpty(adminStaff, JUS_VALUES + "/" + id + "/archive").andExpect(status().isForbidden());
        postEmpty(paralegal, JUS_VALUES + "/" + id + "/restore").andExpect(status().isForbidden());
        getAs(paralegal, JUS_VALUES).andExpect(status().isOk()).andExpect(jsonPath("$.values", hasSize(1)));
    }

    @Test
    void shouldListTheHistoryNewestFirstWithTheValueThatAppliesToday() throws Exception {
        createJusValue(owner, "1000", "2020-01-01");
        createJusValue(owner, "2000", "2021-01-01");
        String announced = LocalDate.now().plusMonths(6).toString();
        createJusValue(owner, "3000", announced);

        getAs(lawyer, JUS_VALUES)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.values", hasSize(3)))
                .andExpect(jsonPath("$.values[0].validFrom").value(announced))
                .andExpect(jsonPath("$.values[1].validFrom").value("2021-01-01"))
                .andExpect(jsonPath("$.values[2].validFrom").value("2020-01-01"))
                .andExpect(jsonPath("$.current.value").value(2000.0))
                .andExpect(jsonPath("$.current.validFrom").value("2021-01-01"));
    }

    @Test
    void shouldAnswerNoCurrentValueWhenTheFirmHasNone() throws Exception {
        getAs(owner, JUS_VALUES)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current").doesNotExist())
                .andExpect(jsonPath("$.values", hasSize(0)));
    }

    @Test
    void shouldRejectAnInvalidValueOrDay() throws Exception {
        postJson(owner, JUS_VALUES, "{\"value\": 0, \"validFrom\": \"2026-07-01\"}").andExpect(status().isBadRequest());
        postJson(owner, JUS_VALUES, "{\"value\": -5, \"validFrom\": \"2026-07-01\"}").andExpect(status().isBadRequest());
        postJson(owner, JUS_VALUES, "{\"value\": 10.123, \"validFrom\": \"2026-07-01\"}").andExpect(status().isBadRequest());
        postJson(owner, JUS_VALUES, "{\"validFrom\": \"2026-07-01\"}").andExpect(status().isBadRequest());
        postJson(owner, JUS_VALUES, "{\"value\": 1000}").andExpect(status().isBadRequest());
        postJson(owner, JUS_VALUES, "{\"value\": 1000, \"validFrom\": \"2099-01-01\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("validFrom"));
        postJson(owner, JUS_VALUES, "{\"value\": 1000, \"validFrom\": \"1999-12-31\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("validFrom"));
        getAs(owner, JUS_VALUES).andExpect(jsonPath("$.values", hasSize(0)));
    }

    @Test
    void shouldRejectASecondActiveValueFromTheSameDay() throws Exception {
        String first = createJusValue(owner, "1000", "2026-07-01");

        postJson(lawyer, JUS_VALUES, "{\"value\": 2000, \"validFrom\": \"2026-07-01\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/duplicate-jus-value"));

        postEmpty(owner, JUS_VALUES + "/" + first + "/archive").andExpect(status().isNoContent());
        createJusValue(lawyer, "2000", "2026-07-01");
    }

    @Test
    void shouldArchiveAndRestoreWithoutDeleting() throws Exception {
        String id = createJusValue(lawyer, "1000", "2026-07-01");

        postEmpty(lawyer, JUS_VALUES + "/" + id + "/archive").andExpect(status().isNoContent());
        postEmpty(lawyer, JUS_VALUES + "/" + id + "/archive").andExpect(status().isNoContent());
        getAs(owner, JUS_VALUES).andExpect(jsonPath("$.values", hasSize(0)));
        getAs(owner, JUS_VALUES + "?includeArchived=true")
                .andExpect(jsonPath("$.values", hasSize(1)))
                .andExpect(jsonPath("$.values[0].archived").value(true))
                .andExpect(jsonPath("$.current").doesNotExist());

        postEmpty(owner, JUS_VALUES + "/" + id + "/restore").andExpect(status().isNoContent());
        getAs(owner, JUS_VALUES)
                .andExpect(jsonPath("$.values", hasSize(1)))
                .andExpect(jsonPath("$.values[0].archived").value(false));
    }

    @Test
    void shouldNotRestoreAValueWhenAnotherIsActiveFromTheSameDay() throws Exception {
        String wrong = createJusValue(owner, "1000", "2026-07-01");
        postEmpty(owner, JUS_VALUES + "/" + wrong + "/archive").andExpect(status().isNoContent());
        createJusValue(owner, "2000", "2026-07-01");

        postEmpty(owner, JUS_VALUES + "/" + wrong + "/restore").andExpect(status().isConflict());
    }

    @Test
    void shouldAnswerNotFoundForAnUnknownValue() throws Exception {
        postEmpty(owner, JUS_VALUES + "/" + NO_SUCH_VALUE + "/archive").andExpect(status().isNotFound());
        postEmpty(owner, JUS_VALUES + "/" + NO_SUCH_VALUE + "/restore").andExpect(status().isNotFound());
    }

    @Test
    void shouldKeepEachFirmValuesToItself() throws Exception {
        String id = createJusValue(owner, "1000", "2026-07-01");
        createJusValue(otherFirmOwner, "5000", "2026-07-01");

        getAs(otherFirmOwner, JUS_VALUES)
                .andExpect(jsonPath("$.values", hasSize(1)))
                .andExpect(jsonPath("$.values[0].value").value(5000.0));
        postEmpty(otherFirmOwner, JUS_VALUES + "/" + id + "/archive").andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, JUS_VALUES + "/" + id + "/restore").andExpect(status().isNotFound());
        getAs(owner, JUS_VALUES)
                .andExpect(jsonPath("$.values", hasSize(1)))
                .andExpect(jsonPath("$.values[0].archived").value(false));
    }

    @Test
    void shouldWriteEveryChangeToTheAuditLog() throws Exception {
        String id = createJusValue(lawyer, "94963.25", "2026-07-01");
        postEmpty(owner, JUS_VALUES + "/" + id + "/archive").andExpect(status().isNoContent());
        postEmpty(owner, JUS_VALUES + "/" + id + "/restore").andExpect(status().isNoContent());

        List<Map<String, Object>> events = jdbc.queryForList(
                """
                select actor_user_id, action, changes::text as changes from audit_event
                where entity_type = 'JusValue' and entity_id = ?::uuid order by id
                """,
                id);
        assertThat(events).extracting(event -> event.get("action")).containsExactly("CREATE", "ARCHIVE", "RESTORE");
        assertThat(events).extracting(event -> event.get("actor_user_id")).containsExactly(lawyerId, ownerId, ownerId);
        assertThat((String) events.get(0).get("changes")).contains("94963.25").contains("2026-07-01");
    }

    @Test
    void shouldRequireALoggedInUser() throws Exception {
        mockMvc.perform(get(JUS_VALUES)).andExpect(status().isUnauthorized());
    }
}
