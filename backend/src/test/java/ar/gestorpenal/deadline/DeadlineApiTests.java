package ar.gestorpenal.deadline;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DeadlineApiTests extends DeadlineApiTestSupport {

    private String caseId;
    private String ana;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, "Caso ficticio de plazos", "");
        ana = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
    }

    @Test
    void shouldComputeTheInvestigationOfADefendantWithItsSourceCaseLawAndDisclaimer() throws Exception {
        LocalDate triggeredOn = TODAY.minusMonths(4).plusDays(10);
        LocalDate dueOn = triggeredOn.plusMonths(4);

        postDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, triggeredOn))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/v1/deadlines/")))
                .andExpect(jsonPath("$.caseId").value(caseId))
                .andExpect(jsonPath("$.caseCaption").value("Caso ficticio de plazos"))
                .andExpect(jsonPath("$.defendantId").value(ana))
                .andExpect(jsonPath("$.defendantName").value("Quiroga Ejemplo, Ana"))
                .andExpect(jsonPath("$.rule.code").value("investigacion-preparatoria"))
                .andExpect(jsonPath("$.rule.source").value("Art. 158; 160 inc. 7 · CPP de Neuquén (Ley 2784)"))
                .andExpect(jsonPath("$.rule.computation").value("MONTHS"))
                .andExpect(jsonPath("$.rule.consequence").value("Extinción de la acción y sobreseimiento"))
                .andExpect(jsonPath("$.rule.caseLawStatus").value(containsString("Olave")))
                .andExpect(jsonPath("$.rule.flags", hasItem("no-verificado")))
                .andExpect(jsonPath("$.rule.flags", hasItem("validar")))
                .andExpect(jsonPath("$.amount").value(4))
                .andExpect(jsonPath("$.triggeredOn").value(triggeredOn.toString()))
                .andExpect(jsonPath("$.dueOn").value(dueOn.toString()))
                .andExpect(jsonPath("$.daysLeft").value(ChronoUnit.DAYS.between(TODAY, dueOn)))
                .andExpect(jsonPath("$.status").value("DUE_SOON"))
                .andExpect(jsonPath("$.extensions", hasSize(0)))
                .andExpect(jsonPath("$.disclaimer").value(DISCLAIMER));
    }

    @Test
    void shouldRunATermInHoursFromTheInstantItStarted() throws Exception {
        postDeadline(lawyer, caseId, """
                        "ruleCode": "control-judicial-detencion", "defendantId": "%s", "triggeredAt": "2026-05-11T02:30:00Z"
                        """.formatted(ana))
                .andExpect(status().isCreated())
                // 23:30 in Neuquén: the local day is the 10th.
                .andExpect(jsonPath("$.triggeredOn").value("2026-05-10"))
                .andExpect(jsonPath("$.dueAt").value("2026-05-12T02:30:00Z"))
                .andExpect(jsonPath("$.dueOn").value("2026-05-11"))
                .andExpect(jsonPath("$.status").value("OVERDUE"))
                .andExpect(jsonPath("$.rule.detainee").value(true));

        postDeadline(lawyer, caseId, dayDeadline("control-judicial-detencion", ana, TODAY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-deadline-data"));
    }

    @Test
    void shouldCountBusinessDaysWithTheNeuquenCourtCalendar() throws Exception {
        // Friday 20 March 2026: Monday 23 (bridge day) and Tuesday 24 (holiday) do not count.
        postDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", null, LocalDate.of(2026, 3, 20)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dueOn").value("2026-03-31"))
                .andExpect(jsonPath("$.dueAt").value("2026-04-01T03:00:00Z"));

        postDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", null, LocalDate.of(2027, 12, 28)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("NOT_CALCULABLE"))
                .andExpect(jsonPath("$.missingYear").value(2028))
                .andExpect(jsonPath("$.dueOn").doesNotExist());
    }

    @Test
    void shouldRequireADefendantOnlyForTheRulesThatRunPerDefendant() throws Exception {
        String otherCase = createCase(lawyer, "Otro caso ficticio", "");
        String beto = createDefendant(lawyer, otherCase, "Beto", "Paz Ejemplo");

        postDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", null, TODAY))
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", ana, TODAY))
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", beto, TODAY))
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("regla-inexistente", null, TODAY))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldTakeTheDateTheCourtSetOnlyForAJudicialDeadline() throws Exception {
        LocalDate start = TODAY.minusDays(20);
        postDeadline(lawyer, caseId, dayDeadline("duracion-fijada-prision-preventiva", ana, start))
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("duracion-fijada-prision-preventiva", ana, start)
                        + ", \"setDueOn\": \"" + start.minusDays(1) + "\"")
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, start)
                        + ", \"setDueOn\": \"" + TODAY.plusDays(40) + "\"")
                .andExpect(status().isBadRequest());

        postDeadline(lawyer, caseId, dayDeadline("duracion-fijada-prision-preventiva", ana, start)
                        + ", \"setDueOn\": \"" + TODAY.plusDays(40) + "\"")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dueOn").value(TODAY.plusDays(40).toString()))
                .andExpect(jsonPath("$.amount").doesNotExist())
                .andExpect(jsonPath("$.rule.kind").value("JUDICIAL"))
                .andExpect(jsonPath("$.status").value("RUNNING"));
    }

    @Test
    void shouldChainTheExtensionsTheLawAllowsAndNoMore() throws Exception {
        String id = createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, LocalDate.of(2026, 1, 15)));
        String extensions = "/api/v1/deadlines/" + id + "/extensions";

        postJson(lawyer, extensions, "{\"amount\": 5, \"grantedOn\": \"2026-05-10\"}").andExpect(status().isBadRequest());
        postJson(lawyer, extensions, "{\"amount\": 4, \"grantedOn\": \"" + TODAY.plusDays(1) + "\"}")
                .andExpect(status().isBadRequest());
        postJson(lawyer, extensions, "{\"amount\": 4, \"grantedOn\": \"2026-05-10\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount").value(8))
                .andExpect(jsonPath("$.dueOn").value("2026-09-15"))
                .andExpect(jsonPath("$.extensions[0].step").value(1))
                .andExpect(jsonPath("$.extensions[0].grantedBy").value("Juez de garantías"));
        postJson(lawyer, extensions, "{\"amount\": 3, \"grantedOn\": \"2026-05-01\"}")
                .andExpect(status().isBadRequest());
        String second = postJson(lawyer, extensions, "{\"amount\": 3, \"grantedOn\": \"2026-09-01\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dueOn").value("2026-12-15"))
                .andExpect(jsonPath("$.extensions[1].grantedBy").value("Colegio de Jueces"))
                .andReturn().getResponse().getContentAsString();
        postJson(lawyer, extensions, "{\"amount\": 1, \"grantedOn\": \"2026-09-02\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/invalid-deadline-state"));

        String firstExtension = JsonPath.read(second, "$.extensions[0].id");
        String secondExtension = JsonPath.read(second, "$.extensions[1].id");
        postEmpty(lawyer, "/api/v1/deadline-extensions/" + firstExtension + "/archive").andExpect(status().isConflict());
        postEmpty(paralegal, "/api/v1/deadline-extensions/" + secondExtension + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/deadline-extensions/" + secondExtension + "/archive")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(8))
                .andExpect(jsonPath("$.dueOn").value("2026-09-15"))
                .andExpect(jsonPath("$.extensions", hasSize(1)));
        postEmpty(lawyer, "/api/v1/deadline-extensions/" + secondExtension + "/archive").andExpect(status().isConflict());

        // Moving the start after an extension was granted would leave the chain inconsistent.
        putJson(lawyer, "/api/v1/deadlines/" + id, "{" + dayDeadline("investigacion-preparatoria", ana, LocalDate.of(2026, 5, 11)) + "}")
                .andExpect(status().isBadRequest());
        getAs(lawyer, "/api/v1/deadlines/" + id).andExpect(jsonPath("$.triggeredOn").value("2026-01-15"));
    }

    @Test
    void shouldRejectDatesOutsideTheSupportedWindow() throws Exception {
        postDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, LocalDate.of(1989, 12, 31)))
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("plazo-judicial", null, TODAY) + ", \"setDueOn\": \"+5000000-01-01\"")
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("plazo-judicial", null, TODAY) + ", \"setDueOn\": \"2101-01-01\"")
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, """
                        "ruleCode": "control-judicial-detencion", "defendantId": "%s", "triggeredAt": "2101-01-01T03:00:00Z"
                        """.formatted(ana))
                .andExpect(status().isBadRequest());
        postJson(lawyer, "/api/v1/cases/" + caseId + "/deadline-suspensions",
                        "{\"kind\": \"MEDIATION\", \"startsOn\": \"2026-02-01\", \"endsOn\": \"9999-12-31\"}")
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("plazo-judicial", null, TODAY) + ", \"setDueOn\": \"2100-12-31\"")
                .andExpect(status().isCreated());
    }

    @Test
    void shouldRefuseAnExtensionToARuleThatAllowsNone() throws Exception {
        String id = createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY));

        postJson(lawyer, "/api/v1/deadlines/" + id + "/extensions", "{\"amount\": 1, \"grantedOn\": \"" + TODAY + "\"}")
                .andExpect(status().isConflict());
    }

    @Test
    void shouldStopTheClockWhileTheDefendantIsInRebellion() throws Exception {
        String id = createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, LocalDate.of(2026, 1, 15)));
        String caseWide = createDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", null, LocalDate.of(2026, 3, 20)));
        String defendant = "/api/v1/cases/" + caseId + "/defendants/" + ana;

        putJson(lawyer, defendant, """
                {"stageCode": "investigacion-preparatoria", "status": "ACTIVE", "defendedByFirm": true,
                 "rebellionDeclaredOn": "2026-02-01"}
                """).andExpect(status().isOk());
        getAs(lawyer, "/api/v1/deadlines/" + id)
                .andExpect(jsonPath("$.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.dueOn").doesNotExist());

        putJson(lawyer, defendant, """
                {"stageCode": "investigacion-preparatoria", "status": "ACTIVE", "defendedByFirm": true,
                 "rebellionDeclaredOn": "2026-02-01", "rebellionLiftedOn": "2026-02-10"}
                """).andExpect(status().isOk());
        getAs(lawyer, "/api/v1/deadlines/" + id)
                .andExpect(jsonPath("$.dueOn").value("2026-05-25"))
                .andExpect(jsonPath("$.suspendedDays").value(10));
        // A rule that rebellion does not suspend is not affected.
        getAs(lawyer, "/api/v1/deadlines/" + caseWide).andExpect(jsonPath("$.dueOn").value("2026-03-31"));
    }

    @Test
    void shouldMarkADeadlineMetAndKeepItsRuleAndDefendant() throws Exception {
        LocalDate start = TODAY.minusDays(3);
        String id = createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, start));
        String url = "/api/v1/deadlines/" + id;

        putJson(lawyer, url, "{" + dayDeadline("revision-prision-preventiva", ana, start)
                        + ", \"metOn\": \"" + TODAY.plusDays(1) + "\"}")
                .andExpect(status().isBadRequest());
        putJson(lawyer, url, "{" + dayDeadline("revision-desestimacion-victima", null, start) + "}")
                .andExpect(status().isBadRequest());
        String beto = createDefendant(lawyer, caseId, "Beto", "Paz Ejemplo");
        putJson(lawyer, url, "{" + dayDeadline("revision-prision-preventiva", beto, start) + "}")
                .andExpect(status().isBadRequest());
        putJson(lawyer, url, "{" + dayDeadline("revision-prision-preventiva", ana, start)
                        + ", \"metOn\": \"" + TODAY + "\", \"notes\": \"  Audiencia realizada  \"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("MET"))
                .andExpect(jsonPath("$.metOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.notes").value("Audiencia realizada"));
    }

    @Test
    void shouldLinkOnlyAHearingOfTheSameCase() throws Exception {
        String otherCase = createCase(lawyer, "Otro caso ficticio", "");
        String hearing = idOf(postJson(lawyer, "/api/v1/cases/" + otherCase + "/hearings",
                        "{\"typeCode\": \"formulacion-de-cargos\", \"startsAt\": \"2035-03-01T12:00:00Z\"}")
                .andExpect(status().isCreated()));

        postDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY)
                        + ", \"hearingId\": \"" + hearing + "\"")
                .andExpect(status().isBadRequest());
        postDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY)
                        + ", \"hearingId\": \"" + UUID.randomUUID() + "\"")
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldListTheDeadlinesOfACaseDetaineesFirstAndArchiveThemWithoutDeleting() throws Exception {
        String investigation = createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, TODAY));
        String review = createDeadline(lawyer, caseId, dayDeadline("revision-prision-preventiva", ana, TODAY));
        String list = "/api/v1/cases/" + caseId + "/deadlines";

        getAs(paralegal, list)
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(review))
                .andExpect(jsonPath("$[1].id").value(investigation));

        postEmpty(paralegal, "/api/v1/deadlines/" + review + "/archive").andExpect(status().isForbidden());
        postEmpty(lawyer, "/api/v1/deadlines/" + review + "/archive").andExpect(status().isNoContent());
        getAs(lawyer, list).andExpect(jsonPath("$", hasSize(1)));
        getAs(lawyer, list + "?includeArchived=true")
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].archived").value(true));
        putJson(lawyer, "/api/v1/deadlines/" + review, "{" + dayDeadline("revision-prision-preventiva", ana, TODAY) + "}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("/problems/archived-record"));

        postEmpty(lawyer, "/api/v1/deadlines/" + review + "/restore").andExpect(status().isNoContent());
        getAs(lawyer, list).andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void shouldRefuseNewDeadlinesOnAnArchivedCaseOrDefendant() throws Exception {
        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/defendants/" + ana + "/archive").andExpect(status().isNoContent());
        postDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, TODAY)).andExpect(status().isConflict());

        postEmpty(lawyer, "/api/v1/cases/" + caseId + "/archive").andExpect(status().isNoContent());
        postDeadline(lawyer, caseId, dayDeadline("impugnacion-ordinaria", null, TODAY)).andExpect(status().isConflict());
    }

    @Test
    void shouldKeepAnotherFirmsDeadlinesOutOfReach() throws Exception {
        String id = createDeadline(lawyer, caseId, dayDeadline("investigacion-preparatoria", ana, TODAY));

        getAs(otherFirmOwner, "/api/v1/deadlines/" + id).andExpect(status().isNotFound());
        getAs(otherFirmOwner, "/api/v1/cases/" + caseId + "/deadlines").andExpect(status().isNotFound());
        postDeadline(otherFirmOwner, caseId, dayDeadline("impugnacion-ordinaria", null, TODAY))
                .andExpect(status().isNotFound());
        postEmpty(otherFirmOwner, "/api/v1/deadlines/" + id + "/archive").andExpect(status().isNotFound());
        getAs(otherFirmOwner, "/api/v1/deadlines?withinDays=365").andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void shouldHideTheDeadlinesOfAReservedCaseFromThoseOutsideItsTeam() throws Exception {
        String reserved = createCase(lawyer, "Caso reservado ficticio", ", \"reserved\": true");
        String beto = createDefendant(lawyer, reserved, "Beto", "Paz Ejemplo");
        String id = createDeadline(lawyer, reserved, dayDeadline("revision-prision-preventiva", beto, TODAY));

        getAs(otherLawyer, "/api/v1/deadlines/" + id).andExpect(status().isNotFound());
        getAs(paralegal, "/api/v1/deadlines").andExpect(jsonPath("$", hasSize(0)));
        getAs(owner, "/api/v1/deadlines").andExpect(jsonPath("$[0].id").value(id));
        getAs(lawyer, "/api/v1/deadlines").andExpect(jsonPath("$[0].id").value(id));
    }
}
