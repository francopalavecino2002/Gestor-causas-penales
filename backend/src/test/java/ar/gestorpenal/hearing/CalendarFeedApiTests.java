package ar.gestorpenal.hearing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * The private calendar feed and the one-hearing {@code .ics} download (ADR-0034). The feed is fetched
 * without a session, as a calendar app would.
 */
class CalendarFeedApiTests extends HearingApiTestSupport {

    private static final String MY_FEED = "/api/v1/me/calendar-feed";

    @Autowired
    JdbcTemplate jdbc;

    private String caseId;

    @BeforeEach
    void openCase() throws Exception {
        caseId = createCase(lawyer, caseJson("Caso ficticio de calendario", ""));
    }

    @Test
    void aNewLinkShouldServeTheHearingsTheMemberAttendsWithoutASession() throws Exception {
        String mine = createHearing(lawyer, caseId, hearingJson("2035-05-10", "13:00",
                ", \"durationMinutes\": 45, \"room\": \"Sala 3\", \"judge\": \"Juez Ficticio\","
                        + " \"ofijuReference\": \"OFJ-0001-FICT\""));
        String theirs = createHearing(lawyer, caseId,
                hearingJson("2035-05-10", "15:00", ", \"lawyerIds\": [\"" + otherLawyerId + "\"]"));

        String path = issue(lawyer);
        assertThat(path).startsWith("/api/v1/calendar-feed/").endsWith(".ics");

        String calendar = fetch(path)
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/calendar"))
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String unfolded = unfold(calendar);
        assertThat(calendar).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n");
        assertThat(unfolded)
                .contains("UID:" + mine + "@gestor-causas")
                .doesNotContain(theirs)
                .contains("DTSTART:20350510T130000Z")
                .contains("DTEND:20350510T134500Z")
                .contains("SUMMARY:Formulación de cargos · Caso ficticio de calendario")
                .contains("LOCATION:Sala 3")
                .contains("Juez/a: Juez Ficticio")
                .contains("Referencia OFIJU: OFJ-0001-FICT")
                .contains("STATUS:CONFIRMED");
        getAs(lawyer, MY_FEED).andExpect(jsonPath("$.active").value(true)).andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void theFeedShouldNotCarryDefendantsNotesOrTheCaptionOfAReservedCase() throws Exception {
        String defendant = createDefendant(lawyer, caseId, "Ana", "Quiroga Ejemplo");
        createHearing(lawyer, caseId, hearingJson("2035-05-10", "13:00",
                ", \"defendantIds\": [\"" + defendant + "\"], \"notes\": \"Nota interna ficticia\""));
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        createHearing(lawyer, reservedCase,
                hearingJson("2035-05-11", "13:00", ", \"judge\": \"Jueza Reservada Ficticia\""));

        String calendar = unfold(fetchBody(issue(lawyer)));

        assertThat(calendar)
                .contains("SUMMARY:Formulación de cargos · Causa reservada")
                .doesNotContain("Caso reservado ficticio")
                .doesNotContain("Jueza Reservada Ficticia")
                .doesNotContain("Quiroga")
                .doesNotContain("Nota interna ficticia");
    }

    @Test
    void aNewLinkShouldRevokeTheOldOneAndRevokingShouldStopTheFeed() throws Exception {
        String first = issue(lawyer);
        String second = issue(lawyer);
        assertThat(second).isNotEqualTo(first);

        fetch(first).andExpect(status().isNotFound());
        fetch(second).andExpect(status().isOk());

        postEmpty(lawyer, MY_FEED + "/revoke").andExpect(status().isNoContent());
        fetch(second).andExpect(status().isNotFound());
        getAs(lawyer, MY_FEED).andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void anUnknownOrMalformedSecretShouldAnswerNotFound() throws Exception {
        fetch("/api/v1/calendar-feed/" + "A".repeat(43) + ".ics").andExpect(status().isNotFound());
        fetch("/api/v1/calendar-feed/no-es-un-secreto.ics").andExpect(status().isNotFound());
    }

    @Test
    void onlyTheHashOfTheSecretShouldBeStored() throws Exception {
        String path = issue(lawyer);
        String secret = path.substring("/api/v1/calendar-feed/".length(), path.length() - ".ics".length());

        Integer withSecret = jdbc.queryForObject(
                "select count(*) from calendar_feed_token where token_hash = ?", Integer.class, secret);
        Integer live = jdbc.queryForObject(
                "select count(*) from calendar_feed_token where user_id = ? and revoked_at is null", Integer.class, lawyerId);
        assertThat(withSecret).isZero();
        assertThat(live).isOne();
    }

    @Test
    void theFeedShouldStopWhenItsOwnerIsArchived() throws Exception {
        String path = issue(lawyer);
        jdbc.update("update app_user set archived_at = now() where id = ?", lawyerId);

        fetch(path).andExpect(status().isNotFound());
    }

    @Test
    void theFeedShouldStayInItsOwnersFirmEvenWithAnotherFirmsSession() throws Exception {
        String hearing = createHearing(lawyer, caseId, hearingJson("2035-05-10", "13:00", ""));
        String otherFirmPath = issue(otherFirmOwner);
        String lawyerPath = issue(lawyer);

        assertThat(fetchBody(otherFirmPath)).doesNotContain(hearing);
        String withForeignSession = mockMvc.perform(get(lawyerPath).with(otherFirmOwner))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(withForeignSession).contains(hearing);
    }

    @Test
    void theFeedShouldLeaveOutArchivedHearingsArchivedCasesAndCasesTheMemberCannotSee() throws Exception {
        String kept = createHearing(lawyer, caseId, hearingJson("2035-05-10", "13:00", ""));
        String archived = createHearing(lawyer, caseId, hearingJson("2035-05-10", "15:00", ""));
        postEmpty(lawyer, "/api/v1/hearings/" + archived + "/archive").andExpect(status().isNoContent());
        String archivedCase = createCase(lawyer, caseJson("Caso archivado ficticio", ""));
        String ofArchivedCase = createHearing(lawyer, archivedCase, hearingJson("2035-05-10", "17:00", ""));
        postEmpty(lawyer, "/api/v1/cases/" + archivedCase + "/archive").andExpect(status().isNoContent());
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        String reservedForParalegal = createHearing(lawyer, reservedCase,
                hearingJson("2035-05-11", "13:00", ", \"lawyerIds\": [\"" + paralegalId + "\"]"));
        String openForParalegal = createHearing(lawyer, caseId,
                hearingJson("2035-05-11", "15:00", ", \"lawyerIds\": [\"" + paralegalId + "\"]"));

        assertThat(fetchBody(issue(lawyer))).contains(kept).doesNotContain(archived).doesNotContain(ofArchivedCase);
        assertThat(fetchBody(issue(paralegal))).contains(openForParalegal).doesNotContain(reservedForParalegal);
    }

    @Test
    void theFeedShouldKeepOnlyTheLast90DaysOfPastHearings() throws Exception {
        LocalDate today = LocalDate.now(HearingCalendar.ZONE);
        String recent = createHearing(lawyer, caseId, hearingJson(today.minusDays(30).toString(), "13:00", ""));
        String old = createHearing(lawyer, caseId, hearingJson(today.minusDays(100).toString(), "13:00", ""));

        assertThat(fetchBody(issue(lawyer))).contains(recent).doesNotContain(old);
    }

    @Test
    void theFeedShouldFollowItsOwnersCurrentRole() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        String reserved = createHearing(lawyer, reservedCase,
                hearingJson("2035-05-10", "13:00", ", \"lawyerIds\": [\"" + ownerId + "\"]"));
        String path = issue(owner);
        assertThat(fetchBody(path)).contains(reserved);

        // The owner is no longer the owner, and is not on the reserved case's team.
        jdbc.update("update app_user set role = 'LAWYER' where id = ?", ownerId);

        assertThat(fetchBody(path)).doesNotContain(reserved);
    }

    @Test
    void anArchivedHearingShouldDownloadAsCancelled() throws Exception {
        String hearing = createHearing(lawyer, caseId, hearingJson("2035-05-10", "13:00", ""));
        postEmpty(lawyer, "/api/v1/hearings/" + hearing + "/archive").andExpect(status().isNoContent());

        String file = getAs(lawyer, "/api/v1/hearings/" + hearing + "/calendar.ics")
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(file).contains("UID:" + hearing + "@gestor-causas").contains("STATUS:CANCELLED");
    }

    @Test
    void theFeedShouldStopWhenItsFirmIsArchived() throws Exception {
        String path = issue(lawyer);
        jdbc.update("update tenant set archived_at = now() where id = (select tenant_id from app_user where id = ?)", lawyerId);

        fetch(path).andExpect(status().isNotFound());
    }

    @Test
    void calendarAppsMayCheckTheFeedWithHead() throws Exception {
        String path = issue(lawyer);

        mockMvc.perform(head(path)).andExpect(status().isOk());
        fetch(path).andExpect(header().string("Referrer-Policy", "no-referrer"));
    }

    @Test
    void issuingALinkShouldBeAuditedWithoutItsHash() throws Exception {
        String path = issue(lawyer);
        String secret = path.substring("/api/v1/calendar-feed/".length(), path.length() - ".ics".length());
        String hash = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.US_ASCII)));

        List<String> changes = jdbc.queryForList(
                "select changes::text from audit_event where entity_type like '%CalendarFeedToken' and actor_user_id = ?",
                String.class, lawyerId);
        assertThat(changes).isNotEmpty().allSatisfy(change -> assertThat(change).doesNotContain(hash));
    }

    @Test
    void managingTheLinkShouldRequireASession() throws Exception {
        mockMvc.perform(get(MY_FEED)).andExpect(status().isUnauthorized());
    }

    @Test
    void oneHearingShouldDownloadAsAnIcsFileForThoseWhoMaySeeIt() throws Exception {
        String reservedCase = createCase(lawyer, caseJson("Caso reservado ficticio", ", \"reserved\": true"));
        String reserved = createHearing(lawyer, reservedCase, hearingJson("2035-05-10", "13:00", ""));

        String file = getAs(lawyer, "/api/v1/hearings/" + reserved + "/calendar.ics")
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/calendar"))
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(unfold(file))
                .contains("UID:" + reserved + "@gestor-causas")
                .contains("Causa reservada")
                .doesNotContain("Caso reservado ficticio");

        getAs(otherLawyer, "/api/v1/hearings/" + reserved + "/calendar.ics").andExpect(status().isNotFound());
        getAs(otherFirmOwner, "/api/v1/hearings/" + reserved + "/calendar.ics").andExpect(status().isNotFound());
        getAs(lawyer, "/api/v1/hearings/" + UUID.randomUUID() + "/calendar.ics").andExpect(status().isNotFound());
    }

    private String issue(RequestPostProcessor user) throws Exception {
        ResultActions result = postEmpty(user, MY_FEED).andExpect(status().isCreated());
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.path");
    }

    private ResultActions fetch(String path) throws Exception {
        return mockMvc.perform(get(path));
    }

    private String fetchBody(String path) throws Exception {
        return fetch(path).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    /** Joins folded lines back (RFC 5545 §3.1), so a long value can be searched as one string. */
    private static String unfold(String calendar) {
        return calendar.replace("\r\n ", "");
    }
}
