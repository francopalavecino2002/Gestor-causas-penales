package ar.gestorpenal.jurisdiction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.assertj.core.api.Assertions.tuple;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

/** The Neuquén package as shipped, and the rules every package must follow. */
class JurisdictionPackageLoaderTests {

    private final JurisdictionPackageLoader loader = new JurisdictionPackageLoader();

    private final JurisdictionPackage neuquen = JurisdictionRegistry.fromClasspath().get("neuquen");

    private final PracticeArea penal = neuquen.area("penal").orElseThrow();

    @Test
    void neuquenShouldProvideEveryCatalogWithTheReviewedItems() {
        assertThat(neuquen.code()).isEqualTo("neuquen");
        assertThat(neuquen.version()).isEqualTo(2);
        assertThat(neuquen.law()).contains("Ley 2784");
        assertThat(neuquen.reviewedOn()).isEqualTo(LocalDate.of(2026, 11, 21));
        assertThat(neuquen.catalogs()).containsOnlyKeys(Catalog.CIRCUMSCRIPTIONS);
        assertThat(penal.catalogs()).containsOnlyKeys(
                Arrays.stream(Catalog.values()).filter(catalog -> catalog.scope() == Catalog.Scope.AREA).toList());

        Map<Catalog, Integer> expectedCounts = Map.ofEntries(
                Map.entry(Catalog.STAGES, 10),
                Map.entry(Catalog.CLOSING_OUTCOMES, 13),
                Map.entry(Catalog.HEARING_TYPES, 28),
                Map.entry(Catalog.HEARING_STATUSES, 8),
                Map.entry(Catalog.CANCELLATION_REASONS, 8),
                Map.entry(Catalog.COERCIVE_MEASURES, 9),
                Map.entry(Catalog.PROCEDURAL_RISKS, 4),
                Map.entry(Catalog.LIBERTY_SITUATIONS, 7),
                Map.entry(Catalog.ALTERNATIVE_OUTCOMES, 9),
                Map.entry(Catalog.PARTY_ROLES, 11),
                Map.entry(Catalog.ACTION_TYPES, 3),
                Map.entry(Catalog.REPRESENTED_SIDES, 2));
        expectedCounts.forEach((catalog, count) ->
                assertThat(penal.catalog(catalog).items()).as(catalog.id()).hasSize(count));
        assertThat(neuquen.sharedCatalog(Catalog.CIRCUMSCRIPTIONS).items()).hasSize(6);
    }

    @Test
    void stagesShouldFollowTheProceduralOrderWithTheirArticles() {
        List<CatalogItemDefinition> stages = penal.catalog(Catalog.STAGES).items();

        assertThat(stages).extracting(CatalogItemDefinition::code).startsWith(
                "averiguacion-preliminar", "investigacion-preparatoria", "conclusion-de-la-investigacion");
        assertThat(stages.getLast().code()).isEqualTo("cerrada");
        assertThat(stages.get(1).article()).isEqualTo("133 a 158");
    }

    @Test
    void shouldKeepTheReviewFlagsOfTheDomainReview() {
        assertThat(penal.catalog(Catalog.STAGES).item("conclusion-de-la-investigacion").orElseThrow().flags())
                .containsExactly(ReviewFlag.NO_VERIFICADO);
        assertThat(penal.catalog(Catalog.HEARING_TYPES).item("prorroga-de-la-investigacion").orElseThrow())
                .satisfies(item -> {
                    assertThat(item.article()).isEqualTo("158");
                    assertThat(item.flags()).containsExactly(ReviewFlag.VALIDAR);
                });
        assertThat(penal.catalog(Catalog.HEARING_TYPES).flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(neuquen.sharedCatalog(Catalog.CIRCUMSCRIPTIONS).item("vi-vaca-muerta").orElseThrow().flags())
                .containsExactly(ReviewFlag.VALIDAR);
        assertThat(penal.catalog(Catalog.PROCEDURAL_RISKS).item("reiterancia").orElseThrow().flags())
                .containsExactly(ReviewFlag.VALIDAR);
    }

    @Test
    void hearingTypesShouldBeOrderedByHowOftenTheyWereHeldIn2014() {
        List<CatalogItemDefinition> types = penal.catalog(Catalog.HEARING_TYPES).items();
        List<Integer> counts = types.stream()
                .map(type -> type.attributes().get("heldIn2014"))
                .takeWhile(count -> count != null)
                .map(Integer::valueOf)
                .toList();

        assertThat(types.getFirst().code()).isEqualTo("formulacion-de-cargos");
        assertThat(types.getFirst().attributes()).containsEntry("heldIn2014", "1346").containsEntry("group", "Investigación");
        assertThat(counts).hasSize(20).isSortedAccordingTo((a, b) -> Integer.compare(b, a));
        assertThat(types.subList(counts.size(), types.size()))
                .allSatisfy(type -> assertThat(type.attributes()).doesNotContainKey("heldIn2014"));
        assertThat(types.getLast().code()).isEqualTo("otra");
    }

    @Test
    void coerciveMeasuresShouldListTheSevenOfArticle113InOrder() {
        List<String> positions = penal.catalog(Catalog.COERCIVE_MEASURES).items().stream()
                .filter(measure -> measure.attributes().containsKey("position113"))
                .map(measure -> measure.attributes().get("position113"))
                .toList();

        assertThat(positions).containsExactly("1", "2", "3", "4", "5", "6", "7");
        assertThat(penal.catalog(Catalog.COERCIVE_MEASURES).item("prision-preventiva").orElseThrow().article())
                .startsWith("113");
    }

    @Test
    void shouldReportEveryProblemOfABrokenPackageAtOnce() {
        InvalidJurisdictionPackageException error = catchThrowableOfType(
                InvalidJurisdictionPackageException.class,
                () -> loader.load(new ClassPathResource("jurisdiction-fixtures/broken/jurisdiction.yml"), List.of()));

        assertThat(error.problems()).contains(
                "jurisdiction.yml: version must be 1 or greater",
                "jurisdiction.yml: code 'provincia-ficticia' must match its folder 'broken'",
                "circumscriptions.yml is missing",
                "at least one practice area folder with an area.yml is required");
    }

    @Test
    void shouldReportEveryProblemOfABrokenPracticeAreaAtOnce() {
        Resource jurisdiction = new ClassPathResource("jurisdiction-fixtures/broken-area/jurisdiction.yml");
        Resource area = new ClassPathResource("jurisdiction-fixtures/broken-area/fuero/area.yml");

        InvalidJurisdictionPackageException error = catchThrowableOfType(
                InvalidJurisdictionPackageException.class, () -> loader.load(jurisdiction, List.of(area)));

        assertThat(error.problems()).contains(
                "fuero/area.yml: code 'otro-fuero' must match its folder 'fuero'",
                "fuero/area.yml: name is required",
                "fuero/area.yml: unknown module 'inexistente'",
                "fuero/area.yml: module 'defendants' is listed twice",
                "fuero/area.yml: the module 'detainee-alerts' needs the module 'coercive-measures'",
                "fuero/closing-outcomes.yml is missing",
                "fuero/party-roles.yml is missing",
                "fuero/represented-sides.yml is missing",
                "fuero/liberty-situations.yml is missing",
                "fuero/alternative-outcomes.yml is not used: the area does not declare the module 'alternative-outcomes'");
        assertThat(error.problems()).doesNotContain("fuero/stages.yml is missing");
    }

    @Test
    void shouldRequireAtLeastOnePracticeArea() {
        InvalidJurisdictionPackageException error = catchThrowableOfType(
                InvalidJurisdictionPackageException.class,
                () -> loader.load(new ClassPathResource("jurisdiction-fixtures/no-areas/jurisdiction.yml"), List.of()));

        assertThat(error.problems()).containsExactly("at least one practice area folder with an area.yml is required");
    }

    @Test
    void penalShouldDeclareTheCriminalModulesAndKeepItsReviewDate() {
        assertThat(penal.code()).isEqualTo("penal");
        assertThat(penal.name()).isEqualTo("Penal");
        assertThat(penal.law()).contains("Ley 2784");
        assertThat(penal.reviewedOn()).isEqualTo(LocalDate.of(2026, 11, 21));
        assertThat(penal.modules()).containsExactly(PracticeModule.values());
    }

    @Test
    void theTestAreaShouldProvideOnlyTheCatalogsOfItsModules() {
        PracticeArea testArea = neuquen.area("testarea").orElseThrow();

        assertThat(testArea.modules()).isEmpty();
        assertThat(testArea.catalogs()).containsOnlyKeys(
                Catalog.STAGES, Catalog.CLOSING_OUTCOMES, Catalog.HEARING_TYPES, Catalog.HEARING_STATUSES,
                Catalog.CANCELLATION_REASONS, Catalog.PARTY_ROLES, Catalog.ACTION_TYPES, Catalog.REPRESENTED_SIDES);
        assertThat(testArea.catalog(Catalog.COERCIVE_MEASURES)).isNull();
        assertThat(testArea.flags()).containsExactly(ReviewFlag.VALIDAR);
    }

    @Test
    void anAreaShouldNotShareItemsWithAnotherArea() {
        PracticeArea testArea = neuquen.area("testarea").orElseThrow();

        assertThat(testArea.catalog(Catalog.HEARING_TYPES).item("formulacion-de-cargos")).isEmpty();
        assertThat(penal.catalog(Catalog.HEARING_TYPES).item("conciliacion-de-prueba")).isEmpty();
        assertThat(testArea.catalog(Catalog.PARTY_ROLES).item("imputado")).isEmpty();
    }

    @Test
    void shouldShipTheCriminalAndTheThreeNonCriminalAreasOfNeuquen() {
        assertThat(neuquen.areas()).containsKeys("penal", "civil", "laboral", "familia");
        for (String code : List.of("civil", "laboral", "familia")) {
            PracticeArea area = neuquen.area(code).orElseThrow();
            assertThat(area.modules()).as(code + " has no criminal module").isEmpty();
            assertThat(area.flags()).as(code + " is flagged as a draft").contains(ReviewFlag.VALIDAR);
            assertThat(area.note()).as(code + " says it is a draft").contains("Borrador sin validar");
            assertThat(area.source()).isEqualTo("docs/domain/neuquen-otros-fueros.md");
            assertThat(area.catalogs()).containsOnlyKeys(
                    Catalog.STAGES, Catalog.CLOSING_OUTCOMES, Catalog.HEARING_TYPES, Catalog.HEARING_STATUSES,
                    Catalog.CANCELLATION_REASONS, Catalog.PARTY_ROLES, Catalog.ACTION_TYPES, Catalog.REPRESENTED_SIDES);
        }
        assertThat(neuquen.area("civil").orElseThrow().law()).isEqualTo("CPCyC de Neuquén (Ley 3551)");
        assertThat(neuquen.area("civil").orElseThrow().flags()).contains(ReviewFlag.NO_VERIFICADO);
    }

    @Test
    void everyItemOfANonCriminalAreaShouldBeFlaggedToValidateAndCiteNoArticle() {
        for (String code : List.of("civil", "laboral", "familia")) {
            neuquen.area(code).orElseThrow().catalogs().values().forEach(catalog -> {
                assertThat(catalog.items()).isNotEmpty().allSatisfy(item -> {
                    assertThat(item.flags()).as(code + "/" + item.code()).contains(ReviewFlag.VALIDAR);
                    assertThat(item.article()).as(code + "/" + item.code() + " cites no invented article").isNull();
                });
            });
        }
        neuquen.area("laboral").orElseThrow().catalogs().values().forEach(catalog ->
                assertThat(catalog.items()).allSatisfy(item -> assertThat(item.flags()).contains(ReviewFlag.NO_VERIFICADO)));
    }

    @Test
    void everyAreaShouldHaveTheStageAndHearingStatusesTheCoreDrivesBehaviorFrom() {
        assertThat(neuquen.areas().values()).allSatisfy(area -> {
            assertThat(area.catalog(Catalog.STAGES).item("cerrada")).isPresent();
            assertThat(area.catalog(Catalog.HEARING_STATUSES).items()).extracting(CatalogItemDefinition::code)
                    .contains("programada", "reprogramada", "efectiva", "suspendida", "cancelada");
        });
    }

    @Test
    void theNonCriminalAreasShouldNotShareItemsWithPenalOrWithEachOther() {
        PracticeArea civil = neuquen.area("civil").orElseThrow();
        PracticeArea familia = neuquen.area("familia").orElseThrow();

        assertThat(civil.catalog(Catalog.PARTY_ROLES).item("imputado")).isEmpty();
        assertThat(civil.catalog(Catalog.ACTION_TYPES).item("public")).isEmpty();
        assertThat(penal.catalog(Catalog.ACTION_TYPES).item("ordinario")).isEmpty();
        assertThat(civil.catalog(Catalog.ACTION_TYPES).item("contencioso")).isEmpty();
        assertThat(familia.catalog(Catalog.ACTION_TYPES).item("contencioso")).isPresent();
    }

    @Test
    void thePenalActionAndSideCatalogsShouldMirrorTheStoredValues() {
        assertThat(penal.catalog(Catalog.ACTION_TYPES).items())
                .extracting(CatalogItemDefinition::code, CatalogItemDefinition::article)
                .containsExactly(tuple("public", "99"), tuple("public-on-complaint", "100"), tuple("private", "101"));
        assertThat(penal.catalog(Catalog.REPRESENTED_SIDES).items())
                .extracting(CatalogItemDefinition::code)
                .containsExactly("defence", "private-prosecution");
    }

    @Test
    void shouldRejectUnknownKeysSoThatTyposAreNotSilentlyIgnored() {
        assertThatThrownBy(() -> loader.load(new ClassPathResource("jurisdiction-fixtures/unknown-key/jurisdiction.yml"), List.of()))
                .isInstanceOf(InvalidJurisdictionPackageException.class)
                .hasMessageContaining("cannot read jurisdiction.yml");
    }

    @Test
    void shouldRejectDuplicateKeysInsteadOfKeepingTheLastValue() {
        assertThatThrownBy(() -> loader.load(new ClassPathResource("jurisdiction-fixtures/duplicate-key/jurisdiction.yml"), List.of()))
                .isInstanceOf(InvalidJurisdictionPackageException.class)
                .hasMessageContaining("cannot read jurisdiction.yml");
    }

    @Test
    void registryShouldFindThePackagesOnTheClasspath() {
        JurisdictionRegistry registry = JurisdictionRegistry.fromClasspath();

        assertThat(registry.codes()).containsExactly("neuquen");
        assertThat(registry.get("neuquen").area("penal").orElseThrow().catalog(Catalog.STAGES).items()).isNotEmpty();
        assertThat(registry.find("chubut")).isEmpty();
    }

    @Test
    void registryShouldRejectDuplicateCodesAndAMissingDefaultPackage() {
        assertThatThrownBy(() -> new JurisdictionRegistry(List.of(neuquen, neuquen)))
                .hasMessageContaining("Two jurisdiction packages use the code neuquen");
        assertThatThrownBy(() -> new JurisdictionRegistry(List.of()))
                .hasMessageContaining("default jurisdiction package 'neuquen' is missing");
    }

    @Test
    void registryShouldRequireTheDefaultPracticeAreaInTheDefaultJurisdiction() {
        JurisdictionPackage withoutPenal = new JurisdictionPackage(neuquen.code(), neuquen.name(), neuquen.version(),
                neuquen.law(), neuquen.reviewedOn(), neuquen.source(), neuquen.catalogs(),
                Map.of("testarea", neuquen.area("testarea").orElseThrow()));

        assertThatThrownBy(() -> new JurisdictionRegistry(List.of(withoutPenal)))
                .hasMessageContaining("needs the practice area 'penal'");
    }

    @Test
    void everyCatalogIdShouldRoundTrip() {
        assertThat(Arrays.stream(Catalog.values()).map(catalog -> Catalog.fromId(catalog.id()).orElseThrow()))
                .containsExactly(Catalog.values());
        assertThat(Catalog.fromId("STAGES")).isEmpty();
        assertThat(Arrays.stream(Catalog.values()).filter(Catalog::extensible)).allMatch(Catalog::hideable);
    }
}
