package ar.gestorpenal.deadline;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ar.gestorpenal.TestcontainersConfiguration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** The public calculator, without any session: every request is anonymous (ADR-0041). */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PublicDeadlineApiTests {

    private static final String RULES = "/api/v1/public/deadline-rules";
    private static final String CALCULATION = "/api/v1/public/deadline-calculation";
    private static final String DISCLAIMER = "Cálculo asistido: verificá con la norma.";
    private static final AtomicInteger NEXT_CLIENT = new AtomicInteger(1);

    @Autowired
    MockMvc mockMvc;

    /** A documentation address (RFC 5737) per test, so the rate limit of one test never reaches another. */
    private String client;

    @BeforeEach
    void newClient() {
        int n = NEXT_CLIENT.getAndIncrement();
        client = "198.51." + (n / 250) + "." + (n % 250 + 1);
    }

    @Test
    void shouldListTheRulesAStartDateIsEnoughForWithoutLogin() throws Exception {
        anonymousGet(RULES)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(12)))
                .andExpect(jsonPath("$[0].code").value("control-judicial-detencion"))
                .andExpect(jsonPath("$[0].source").value("Art. 112; 49 inc. 5 · CPP de Neuquén (Ley 2784)"))
                .andExpect(jsonPath("$[0].computation").value("HOURS"))
                .andExpect(jsonPath("$[0].duration").value(24))
                .andExpect(jsonPath("$[0].flags", hasItem("validar")))
                .andExpect(jsonPath("$[0].disclaimer").value(DISCLAIMER))
                .andExpect(jsonPath("$[*].computation", everyItem(not("SET_BY_COURT"))))
                // No firm settings leak into the public view.
                .andExpect(jsonPath("$[0].enabled").doesNotExist())
                .andExpect(jsonPath("$[0].alertDaysBefore").doesNotExist());
    }

    @Test
    void shouldCountBusinessDaysWithTheCourtCalendar() throws Exception {
        // Friday 2026-11-20: the weekend and the 23rd (Soberanía Nacional) do not count.
        calculate("impugnacion-ordinaria", "2026-11-20", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("DUE"))
                .andExpect(jsonPath("$.dueOn").value("2026-11-30"))
                .andExpect(jsonPath("$.dueAt").value("2026-12-01T03:00:00Z"))
                .andExpect(jsonPath("$.rule.computation").value("BUSINESS_DAYS"))
                .andExpect(jsonPath("$.rule.source").exists())
                .andExpect(jsonPath("$.calendarSource").exists())
                .andExpect(jsonPath("$.calendarFlags", hasItem("validar")))
                .andExpect(jsonPath("$.startTime").doesNotExist())
                .andExpect(jsonPath("$.disclaimer").value(DISCLAIMER));
    }

    @Test
    void shouldCountCalendarMonthsDateToDate() throws Exception {
        calculate("investigacion-preparatoria", "2026-10-31", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueOn").value("2027-02-28"))
                .andExpect(jsonPath("$.calendarSource").doesNotExist());
    }

    @Test
    void shouldCountHoursFromTheStartTimeInNeuquen() throws Exception {
        calculate("control-judicial-detencion", "2026-11-20", "10:30")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startTime", startsWith("10:30")))
                .andExpect(jsonPath("$.dueOn").value("2026-11-21"))
                .andExpect(jsonPath("$.dueAt").value("2026-11-21T13:30:00Z"));
    }

    @Test
    void shouldRequireTheTimeForATermInHours() throws Exception {
        calculate("control-judicial-detencion", "2026-11-20", null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("/problems/invalid-deadline-data"));
    }

    @Test
    void shouldSayWhenTheCourtCalendarLacksTheYear() throws Exception {
        calculate("impugnacion-ordinaria", "2030-03-01", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("CALENDAR_NOT_LOADED"))
                .andExpect(jsonPath("$.missingYear").value(2030))
                .andExpect(jsonPath("$.dueOn").doesNotExist());
    }

    @Test
    void shouldRefuseJudicialDeadlinesUnknownRulesAndBadDates() throws Exception {
        calculate("plazo-judicial", "2026-11-20", null).andExpect(status().isNotFound());
        calculate("regla-inexistente", "2026-11-20", null).andExpect(status().isNotFound());
        calculate("impugnacion-ordinaria", "1999-12-31", null).andExpect(status().isBadRequest());
        calculate("impugnacion-ordinaria", "20-11-2026", null).andExpect(status().isBadRequest());
        calculate("control-judicial-detencion", "2026-11-20", "25:00").andExpect(status().isBadRequest());
        anonymousGet(CALCULATION + "?rule=impugnacion-ordinaria").andExpect(status().isBadRequest());
    }

    @Test
    void shouldOnlyBePublicForReading() throws Exception {
        mockMvc.perform(post(RULES).with(fromClient())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/deadline-rules").with(fromClient())).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRateLimitEachClientAddress() throws Exception {
        for (int i = 0; i < 30; i++) {
            anonymousGet(RULES).andExpect(status().isOk());
        }

        calculate("impugnacion-ordinaria", "2026-11-20", null)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.type").value("/problems/public-calculator-throttled"));
        // Another address is not affected.
        newClient();
        anonymousGet(RULES).andExpect(status().isOk());
    }

    private ResultActions calculate(String rule, String startDate, String startTime) throws Exception {
        String query = "?rule=" + rule + "&startDate=" + startDate + (startTime == null ? "" : "&startTime=" + startTime);
        return anonymousGet(CALCULATION + query);
    }

    private ResultActions anonymousGet(String path) throws Exception {
        return mockMvc.perform(get(path).with(fromClient()));
    }

    private RequestPostProcessor fromClient() {
        String address = client;
        return request -> {
            request.setRemoteAddr(address);
            return request;
        };
    }
}
