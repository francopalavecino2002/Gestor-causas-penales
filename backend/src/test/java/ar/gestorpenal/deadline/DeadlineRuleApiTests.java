package ar.gestorpenal.deadline;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

class DeadlineRuleApiTests extends DeadlineApiTestSupport {

    private static final String RULES = "/api/v1/deadline-rules";

    @Test
    void shouldListTheBuiltInRulesWithTheirSourceFlagsAndDisclaimer() throws Exception {
        getAs(paralegal, RULES)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(14)))
                .andExpect(jsonPath("$[0].code").value("control-judicial-detencion"))
                .andExpect(jsonPath("$[0].source").value("Art. 112; 49 inc. 5 · CPP de Neuquén (Ley 2784)"))
                .andExpect(jsonPath("$[0].computation").value("HOURS"))
                .andExpect(jsonPath("$[0].duration").value(24))
                .andExpect(jsonPath("$[0].detainee").value(true))
                .andExpect(jsonPath("$[0].enabled").value(true))
                .andExpect(jsonPath("$[0].flags", hasItem("validar")))
                .andExpect(jsonPath("$[0].disclaimer").value(DISCLAIMER))
                .andExpect(jsonPath("$[7].code").value("investigacion-preparatoria"))
                .andExpect(jsonPath("$[7].extensions", hasSize(2)))
                .andExpect(jsonPath("$[7].extensions[1].grantedBy").value("Colegio de Jueces"))
                .andExpect(jsonPath("$[7].suspendedBy", hasItem("REBELLION")))
                .andExpect(jsonPath("$[7].caseLaw.reviewedOn").value("2026-11-21"))
                .andExpect(jsonPath("$[7].alertDaysBefore").value(15))
                .andExpect(jsonPath("$[7].defaultAlertDaysBefore").value(15));
    }

    @Test
    void shouldLetOnlyTheOwnerDisableARuleOrChangeItsWarning() throws Exception {
        String settings = RULES + "/investigacion-preparatoria/settings";

        putJson(lawyer, settings, "{\"enabled\": false, \"alertDaysBefore\": 5}").andExpect(status().isForbidden());
        putJson(owner, settings, "{\"enabled\": true, \"alertDaysBefore\": 91}").andExpect(status().isBadRequest());
        putJson(owner, settings, "{\"enabled\": true}").andExpect(status().isBadRequest());
        putJson(owner, RULES + "/regla-inexistente/settings", "{\"enabled\": false, \"alertDaysBefore\": 5}")
                .andExpect(status().isNotFound());

        putJson(owner, settings, "{\"enabled\": false, \"alertDaysBefore\": 5}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.alertDaysBefore").value(5))
                .andExpect(jsonPath("$.defaultAlertDaysBefore").value(15));
        putJson(owner, settings, "{\"enabled\": true, \"alertDaysBefore\": 3}")
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.alertDaysBefore").value(3));
        // Another firm keeps the defaults.
        getAs(otherFirmOwner, RULES)
                .andExpect(jsonPath("$[7].enabled").value(true))
                .andExpect(jsonPath("$[7].alertDaysBefore").value(15));
    }

    @Test
    void shouldRefuseNewDeadlinesOfADisabledRule() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio", "");
        putJson(owner, RULES + "/impugnacion-ordinaria/settings", "{\"enabled\": false, \"alertDaysBefore\": 2}")
                .andExpect(status().isOk());

        postDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", null, TODAY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/invalid-deadline-state"));
    }

    @Test
    void shouldUseTheFirmsWarningForTheStatus() throws Exception {
        String caseId = createCase(lawyer, "Caso ficticio", "");
        String id = createDeadline(lawyer, caseId, dayDeadline("plazo-judicial", null, TODAY)
                + ", \"setDueOn\": \"" + TODAY.plusDays(5) + "\"");
        getAs(lawyer, "/api/v1/deadlines/" + id).andExpect(jsonPath("$.status").value("RUNNING"));

        putJson(owner, RULES + "/plazo-judicial/settings", "{\"enabled\": true, \"alertDaysBefore\": 10}")
                .andExpect(status().isOk());

        getAs(lawyer, "/api/v1/deadlines/" + id).andExpect(jsonPath("$.status").value("DUE_SOON"));
    }

    @Test
    void shouldShowTheCourtCalendarOfAYear() throws Exception {
        getAs(lawyer, "/api/v1/court-calendar?year=2026")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.loaded").value(true))
                .andExpect(jsonPath("$.flags", hasItem("validar")))
                .andExpect(jsonPath("$.days[?(@.date == '2026-03-24')].name")
                        .value("Día Nacional de la Memoria por la Verdad y la Justicia"))
                .andExpect(jsonPath("$.days[?(@.date == '2026-03-23')].flags[0]").value("validar"));
        getAs(lawyer, "/api/v1/court-calendar?year=2031")
                .andExpect(jsonPath("$.loaded").value(false))
                .andExpect(jsonPath("$.days", hasSize(0)));
        getAs(lawyer, "/api/v1/court-calendar").andExpect(jsonPath("$.year").value(TODAY.getYear()));
        getAs(lawyer, "/api/v1/court-calendar?year=1999").andExpect(status().isBadRequest());
    }
}
