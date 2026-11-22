package ar.gestorpenal.jurisdiction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** The Neuquén package as shipped, and the rules every package must follow. */
class JurisdictionPackageLoaderTests {

    private final JurisdictionPackageLoader loader = new JurisdictionPackageLoader();

    private final JurisdictionPackage neuquen =
            loader.load(new ClassPathResource("jurisdictions/neuquen/jurisdiction.yml"));

    @Test
    void neuquenShouldProvideEveryCatalogWithTheReviewedItems() {
        assertThat(neuquen.code()).isEqualTo("neuquen");
        assertThat(neuquen.version()).isEqualTo(1);
        assertThat(neuquen.law()).contains("Ley 2784");
        assertThat(neuquen.reviewedOn()).isEqualTo(LocalDate.of(2026, 11, 21));
        assertThat(neuquen.catalogs()).containsOnlyKeys(Catalog.values());

        Map<Catalog, Integer> expectedCounts = Map.of(
                Catalog.STAGES, 10,
                Catalog.CLOSING_OUTCOMES, 13,
                Catalog.HEARING_TYPES, 28,
                Catalog.HEARING_STATUSES, 8,
                Catalog.CANCELLATION_REASONS, 8,
                Catalog.COERCIVE_MEASURES, 9,
                Catalog.PROCEDURAL_RISKS, 4,
                Catalog.LIBERTY_SITUATIONS, 7,
                Catalog.ALTERNATIVE_OUTCOMES, 9,
                Catalog.CIRCUMSCRIPTIONS, 6);
        expectedCounts.forEach((catalog, count) ->
                assertThat(neuquen.catalog(catalog).items()).as(catalog.id()).hasSize(count));
    }

    @Test
    void stagesShouldFollowTheProceduralOrderWithTheirArticles() {
        List<CatalogItemDefinition> stages = neuquen.catalog(Catalog.STAGES).items();

        assertThat(stages).extracting(CatalogItemDefinition::code).startsWith(
                "averiguacion-preliminar", "investigacion-preparatoria", "conclusion-de-la-investigacion");
        assertThat(stages.getLast().code()).isEqualTo("cerrada");
        assertThat(stages.get(1).article()).isEqualTo("133 a 158");
    }

    @Test
    void shouldKeepTheReviewFlagsOfTheDomainReview() {
        assertThat(neuquen.catalog(Catalog.STAGES).item("conclusion-de-la-investigacion").orElseThrow().flags())
                .containsExactly(ReviewFlag.NO_VERIFICADO);
        assertThat(neuquen.catalog(Catalog.HEARING_TYPES).item("prorroga-de-la-investigacion").orElseThrow())
                .satisfies(item -> {
                    assertThat(item.article()).isEqualTo("158");
                    assertThat(item.flags()).containsExactly(ReviewFlag.VALIDAR);
                });
        assertThat(neuquen.catalog(Catalog.HEARING_TYPES).flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(neuquen.catalog(Catalog.CIRCUMSCRIPTIONS).item("vi-vaca-muerta").orElseThrow().flags())
                .containsExactly(ReviewFlag.VALIDAR);
        assertThat(neuquen.catalog(Catalog.PROCEDURAL_RISKS).item("reiterancia").orElseThrow().flags())
                .containsExactly(ReviewFlag.VALIDAR);
    }

    @Test
    void hearingTypesShouldBeOrderedByHowOftenTheyWereHeldIn2014() {
        List<CatalogItemDefinition> types = neuquen.catalog(Catalog.HEARING_TYPES).items();
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
        List<String> positions = neuquen.catalog(Catalog.COERCIVE_MEASURES).items().stream()
                .filter(measure -> measure.attributes().containsKey("position113"))
                .map(measure -> measure.attributes().get("position113"))
                .toList();

        assertThat(positions).containsExactly("1", "2", "3", "4", "5", "6", "7");
        assertThat(neuquen.catalog(Catalog.COERCIVE_MEASURES).item("prision-preventiva").orElseThrow().article())
                .startsWith("113");
    }

    @Test
    void shouldReportEveryProblemOfABrokenPackageAtOnce() {
        InvalidJurisdictionPackageException error = catchThrowableOfType(
                InvalidJurisdictionPackageException.class,
                () -> loader.load(new ClassPathResource("jurisdiction-fixtures/broken/jurisdiction.yml")));

        assertThat(error.problems()).contains(
                "jurisdiction.yml: version must be 1 or greater",
                "jurisdiction.yml: code 'provincia-ficticia' must match its folder 'broken'",
                "stages.yml: catalog must be 'stages'",
                "stages.yml item 'repetida': duplicate code",
                "stages.yml item 'Con Mayusculas': code must be lowercase words separated by hyphens",
                "stages.yml item 'custom-reservado': codes starting with 'custom-' are reserved for items added by a firm",
                "stages.yml item 'sin-nombre': name must have between 1 and 200 characters",
                "closing-outcomes.yml is missing",
                "circumscriptions.yml is missing");
    }

    @Test
    void shouldRejectUnknownKeysSoThatTyposAreNotSilentlyIgnored() {
        assertThatThrownBy(() -> loader.load(new ClassPathResource("jurisdiction-fixtures/unknown-key/jurisdiction.yml")))
                .isInstanceOf(InvalidJurisdictionPackageException.class)
                .hasMessageContaining("cannot read jurisdiction.yml");
    }

    @Test
    void shouldRejectDuplicateKeysInsteadOfKeepingTheLastValue() {
        assertThatThrownBy(() -> loader.load(new ClassPathResource("jurisdiction-fixtures/duplicate-key/jurisdiction.yml")))
                .isInstanceOf(InvalidJurisdictionPackageException.class)
                .hasMessageContaining("cannot read jurisdiction.yml");
    }

    @Test
    void registryShouldFindThePackagesOnTheClasspath() {
        JurisdictionRegistry registry = JurisdictionRegistry.fromClasspath();

        assertThat(registry.codes()).containsExactly("neuquen");
        assertThat(registry.get("neuquen").catalog(Catalog.STAGES).items()).isNotEmpty();
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
    void everyCatalogIdShouldRoundTrip() {
        assertThat(Arrays.stream(Catalog.values()).map(catalog -> Catalog.fromId(catalog.id()).orElseThrow()))
                .containsExactly(Catalog.values());
        assertThat(Catalog.fromId("STAGES")).isEmpty();
        assertThat(Arrays.stream(Catalog.values()).filter(Catalog::extensible)).allMatch(Catalog::hideable);
    }
}
