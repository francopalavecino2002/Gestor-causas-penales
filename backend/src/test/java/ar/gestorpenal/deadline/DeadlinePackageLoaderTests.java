package ar.gestorpenal.deadline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import ar.gestorpenal.deadline.CourtCalendar.CalendarNotLoadedException;
import ar.gestorpenal.deadline.CourtCalendar.NonBusinessDay;
import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class DeadlinePackageLoaderTests {

    private final DeadlinePackageLoader loader = new DeadlinePackageLoader();

    private final DeadlinePackage neuquen = DeadlinePackages.fromClasspath().get("neuquen");

    @Test
    void shouldShipThe13MvpRulesOfNeuquenPlusTheGenericJudicialDeadline() {
        assertThat(neuquen.rules())
                .extracting(DeadlineRule::code)
                .containsExactly(
                        "control-judicial-detencion",
                        "audiencia-medidas-con-detenido",
                        "formulacion-cargos-con-detenido",
                        "revision-prision-preventiva",
                        "duracion-fijada-prision-preventiva",
                        "duracion-maxima-prision-preventiva",
                        "audiencia-medidas-sin-detenido",
                        "investigacion-preparatoria",
                        "duracion-maxima-proceso",
                        "impugnacion-ordinaria",
                        "revision-desestimacion-victima",
                        "revision-rechazo-querellante",
                        "mediacion-penal",
                        "plazo-judicial");
    }

    @Test
    void shouldListTheDetaineeRulesFirst() {
        List<Boolean> detainee = neuquen.rules().stream().map(DeadlineRule::detainee).toList();

        assertThat(detainee.indexOf(false)).isEqualTo(6);
        assertThat(detainee.subList(6, detainee.size())).doesNotContain(true);
    }

    @Test
    void shouldKeepTheSourceConsequenceAndCaseLawOfEveryRule() {
        assertThat(neuquen.rules()).allSatisfy(rule -> {
            assertThat(neuquen.sourceOf(rule)).isNotBlank();
            assertThat(rule.consequence()).isNotBlank();
            assertThat(rule.caseLaw().status()).isNotBlank();
            assertThat(rule.caseLaw().reviewedOn()).isEqualTo(LocalDate.of(2026, 11, 21));
        });
        DeadlineRule investigation = neuquen.rule("investigacion-preparatoria").orElseThrow();
        assertThat(neuquen.sourceOf(investigation)).isEqualTo("Art. 158; 160 inc. 7 · CPP de Neuquén (Ley 2784)");
        assertThat(investigation.caseLaw().status()).contains("Olave");
        assertThat(investigation.caseLaw().url()).startsWith("https://");
        // Case law is cited by name, never with a case number in the link (CLAUDE.md, rule 1).
        assertThat(neuquen.rules())
                .extracting(rule -> rule.caseLaw().url())
                .allSatisfy(url -> assertThat(url == null ? "" : url).doesNotContainIgnoringCase("leg"));
        assertThat(neuquen.sourceOf(neuquen.rule("mediacion-penal").orElseThrow())).isEqualTo("Ley 2996");
    }

    @Test
    void shouldModelTheChainedExtensionsAndSuspensionsOfTheInvestigation() {
        DeadlineRule investigation = neuquen.rule("investigacion-preparatoria").orElseThrow();

        assertThat(investigation.computation()).isEqualTo(Computation.MONTHS);
        assertThat(investigation.duration()).isEqualTo(4);
        assertThat(investigation.extensions())
                .extracting(DeadlineRule.ExtensionStep::grantedBy, DeadlineRule.ExtensionStep::maxAmount)
                .containsExactly(tuple("Juez de garantías", 4), tuple("Colegio de Jueces", 4));
        assertThat(investigation.suspendedBy()).containsExactly(SuspensionKind.REBELLION, SuspensionKind.MEDIATION);
        assertThat(neuquen.rule("duracion-maxima-proceso").orElseThrow().suspendedBy())
                .contains(SuspensionKind.REBELLION, SuspensionKind.FEDERAL_EXTRAORDINARY_APPEAL);
    }

    @Test
    void shouldFlagEveryRuleFromArticles156To272AsNotVerified() {
        assertThat(neuquen.rules())
                .filteredOn(rule -> DeadlinePackageLoader.citesUnverifiedArticle(rule.article()))
                .extracting(DeadlineRule::code)
                .containsExactly("investigacion-preparatoria", "impugnacion-ordinaria");
        assertThat(neuquen.rules())
                .filteredOn(rule -> DeadlinePackageLoader.citesUnverifiedArticle(rule.article()))
                .allSatisfy(rule -> assertThat(rule.flags()).contains(ReviewFlag.NO_VERIFICADO));
    }

    @Test
    void shouldReadTheArticleNumberAndNotTheInciso() {
        assertThat(DeadlinePackageLoader.citesUnverifiedArticle("158; 160 inc. 7")).isTrue();
        assertThat(DeadlinePackageLoader.citesUnverifiedArticle("272")).isTrue();
        assertThat(DeadlinePackageLoader.citesUnverifiedArticle("155")).isFalse();
        assertThat(DeadlinePackageLoader.citesUnverifiedArticle("273")).isFalse();
        assertThat(DeadlinePackageLoader.citesUnverifiedArticle("112; 49 inc. 5")).isFalse();
        assertThat(DeadlinePackageLoader.citesUnverifiedArticle("64 inc. 200")).isFalse();
        assertThat(DeadlinePackageLoader.citesUnverifiedArticle(null)).isFalse();
    }

    @Test
    void shouldLoadTheNeuquenCourtCalendarWithItsFlags() {
        CourtCalendar calendar = neuquen.calendar();

        assertThat(calendar.covers(2025)).isTrue();
        assertThat(calendar.covers(2027)).isTrue();
        assertThat(calendar.flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(calendar.isBusinessDay(LocalDate.of(2026, 3, 24))).isFalse();
        assertThat(calendar.isBusinessDay(LocalDate.of(2026, 3, 25))).isTrue();
        assertThat(calendar.isBusinessDay(LocalDate.of(2026, 11, 21))).isFalse();
        assertThat(calendar.isBusinessDay(LocalDate.of(2026, 11, 23))).isFalse();
        assertThat(calendar.isBusinessDay(LocalDate.of(2026, 11, 24))).isTrue();
        // The January recess spreads over every day of the month, with its own flag.
        assertThat(calendar.nonBusinessDays(2026))
                .filteredOn(day -> day.date().getMonthValue() == 1)
                .hasSize(31)
                .allSatisfy(day -> {
                    assertThat(day.name()).isEqualTo("Feria judicial de enero");
                    assertThat(day.flags()).containsExactly(ReviewFlag.VALIDAR);
                });
        assertThat(calendar.nonBusinessDays(2026)).extracting(NonBusinessDay::date).isSorted();
        assertThatThrownBy(() -> calendar.isBusinessDay(LocalDate.of(2028, 3, 1)))
                .isInstanceOf(CalendarNotLoadedException.class);
    }

    /**
     * A deliberate tripwire: business-day deadlines are not calculable in a year the calendar lacks,
     * so this fails when a new year starts without its holidays and recesses loaded.
     */
    @Test
    void shouldHaveTheCourtCalendarOfTheCurrentYear() {
        assertThat(neuquen.calendar().covers(LocalDate.now(DeadlineClock.ZONE).getYear()))
                .as("add the current year to jurisdictions/neuquen/court-calendar.yml")
                .isTrue();
    }

    @Test
    void shouldReportEveryProblemOfABrokenPackageAtOnce() {
        assertThatThrownBy(() -> loader.load("broken", new ClassPathResource("deadline-fixtures/broken/deadline-rules.yml")))
                .isInstanceOf(InvalidDeadlinePackageException.class)
                .hasMessageContaining("rule 'Mal-Codigo': code must be lowercase")
                .hasMessageContaining("rule 'judicial-con-duracion': a SET_BY_COURT rule has neither duration nor extensions")
                .hasMessageContaining("rule 'horas-suspendidas': a term in hours runs continuously")
                .hasMessageContaining("rule 'articulo-sin-verificar': articles 156 to 272 must carry the flag no-verificado")
                .hasMessageContaining("rule 'articulo-sin-verificar': alertDaysBefore must be between 0 and 90")
                .hasMessageContaining("rule 'articulo-sin-verificar': duplicate code")
                .hasMessageContaining("rule 'articulo-sin-verificar': duration must be 1 or greater")
                .hasMessageContaining("rule 'articulo-sin-verificar': caseLaw needs a status")
                .hasMessageContaining("entry 'Al revés' (2026-05-10): to cannot be before from")
                .hasMessageContaining("entry 'Año no cargado' (2027-01-01): its year is not listed under years");
    }

    @Test
    void shouldRejectAMisspelledKey() {
        assertThatThrownBy(() -> loader.load("x", new ClassPathResource("deadline-fixtures/unknown-key/deadline-rules.yml")))
                .isInstanceOf(InvalidDeadlinePackageException.class)
                .hasMessageContaining("cannot read deadline-rules.yml");
    }

    @Test
    void shouldRequireTheCourtCalendar() {
        assertThatThrownBy(() -> loader.load("x", new ClassPathResource("deadline-fixtures/no-calendar/deadline-rules.yml")))
                .isInstanceOf(InvalidDeadlinePackageException.class)
                .hasMessageContaining("court-calendar.yml is missing");
    }

    @Test
    void shouldGiveAJurisdictionWithoutRulesAnEmptyPackage() {
        DeadlinePackage none = DeadlinePackages.fromClasspath().get("sin-reglas");

        assertThat(none.rules()).isEmpty();
        assertThat(none.calendar().covers(2026)).isFalse();
    }
}
