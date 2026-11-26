package ar.gestorpenal.fee;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

class FeeScaleLoaderTests {

    private static final String VALID = """
            law: Ley Ficticia
            source: https://ejemplo.test/ley
            scale: {article: art. 7, minPercent: 11, maxPercent: 20, losingPartyFloorFactor: 0.70, flags: [validar]}
            procurador: {article: art. 10, factor: 0.40}
            sponsorAndAttorney: {article: art. 10, factor: 1.40}
            appeal: {article: art. 15, minPercent: 25, maxPercent: 35, fullyRevokedPercent: 35}
            minimums:
              - {code: uno, name: Uno, jus: 10, article: art. 9}
              - {code: dos, name: Dos, jus: 7, article: art. 9, areas: [penal]}
            """;

    private final FeeScaleLoader loader = new FeeScaleLoader();

    @Test
    void shouldLoadTheScaleOfNeuquen() {
        FeeScale scale = loader.load(new ClassPathResource("jurisdictions/neuquen/fees.yml"));

        assertThat(scale.law()).isEqualTo("Ley 1594");
        assertThat(scale.scale().minPercent()).isEqualByComparingTo("11");
        assertThat(scale.scale().maxPercent()).isEqualByComparingTo("20");
        assertThat(scale.scale().losingPartyFloorFactor()).isEqualByComparingTo("0.70");
        assertThat(scale.procurador().factor()).isEqualByComparingTo("0.40");
        assertThat(scale.sponsorAndAttorney().factor()).isEqualByComparingTo("1.40");
        assertThat(scale.appeal().fullyRevokedPercent()).isEqualByComparingTo("35");
        assertThat(scale.minimums()).extracting(FeeMinimum::code).doesNotHaveDuplicates().contains(
                "conocimiento", "ejecucion", "voluntarios-incidentes", "penal-general", "divorcio",
                "defensa-criminal-absolucion", "querella-condena");
        assertThat(scale.minimums()).hasSize(24);
    }

    @Test
    void shouldKeepTheArticleAndTheReviewFlagOfEveryRuleAndMinimum() {
        FeeScale scale = loader.load(new ClassPathResource("jurisdictions/neuquen/fees.yml"));

        assertThat(scale.scale().flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(scale.procurador().flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(scale.appeal().flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(scale.minimums()).allSatisfy(minimum -> {
            assertThat(minimum.article()).startsWith("art. 9");
            assertThat(minimum.flags()).containsExactly(ReviewFlag.VALIDAR);
            assertThat(minimum.name()).isNotBlank();
        });
        FeeMinimum defense = scale.minimum("defensa-criminal-plenario").orElseThrow();
        assertThat(defense.jus()).isEqualByComparingTo("40");
        assertThat(defense.article()).isEqualTo("art. 9, I, 16");
        assertThat(defense.note()).contains("procedimiento escrito anterior");
    }

    @Test
    void shouldLimitThePracticeAreasOfAMinimumAndLeaveTheGeneralOnesOpen() {
        FeeScale scale = loader.load(new ClassPathResource("jurisdictions/neuquen/fees.yml"));

        assertThat(scale.minimum("conocimiento").orElseThrow().appliesTo("laboral")).isTrue();
        assertThat(scale.minimum("divorcio").orElseThrow().appliesTo("familia")).isTrue();
        assertThat(scale.minimum("divorcio").orElseThrow().appliesTo("penal")).isFalse();
        assertThat(scale.minimum("denuncia-penal").orElseThrow().appliesTo("penal")).isTrue();
        assertThat(scale.minimum("denuncia-penal").orElseThrow().appliesTo("civil")).isFalse();
    }

    @Test
    void shouldLoadAValidScale() {
        FeeScale scale = loader.load(yaml(VALID));

        assertThat(scale.minimums()).extracting(FeeMinimum::code).containsExactly("uno", "dos");
        assertThat(scale.minimum("dos").orElseThrow().jus()).isEqualByComparingTo(BigDecimal.valueOf(7));
        assertThat(scale.minimum("uno").orElseThrow().areas()).isEmpty();
        assertThat(scale.minimum("dos").orElseThrow().areas()).isEqualTo(List.of("penal"));
    }

    @Test
    void shouldRejectDuplicateCodes() {
        assertInvalid(VALID.replace("code: dos", "code: uno"), "minimum 'uno': duplicate code");
    }

    @Test
    void shouldRejectAMinimumWithoutPositiveJus() {
        assertInvalid(VALID.replace("jus: 7", "jus: 0"), "minimum 'dos': jus must be greater than 0");
        assertInvalid(VALID.replace("jus: 7", "jus: -3"), "minimum 'dos': jus must be greater than 0");
        assertInvalid(VALID.replace("jus: 7, ", ""), "minimum 'dos': jus must be greater than 0");
    }

    @Test
    void shouldRejectACodeThatIsNotLowercaseWordsWithHyphens() {
        assertInvalid(VALID.replace("code: uno", "code: Uno_1"), "code must be lowercase words separated by hyphens");
    }

    @Test
    void shouldRejectInsanePercentages() {
        assertInvalid(VALID.replace("minPercent: 11", "minPercent: 30"), "scale: minPercent cannot be greater than maxPercent");
        assertInvalid(VALID.replace("maxPercent: 20", "maxPercent: 120"), "scale: minPercent and maxPercent must be");
        assertInvalid(VALID.replace("losingPartyFloorFactor: 0.70", "losingPartyFloorFactor: 1.5"),
                "scale: losingPartyFloorFactor must be");
        assertInvalid(VALID.replace("fullyRevokedPercent: 35", "fullyRevokedPercent: 0"),
                "appeal: fullyRevokedPercent must be");
        assertInvalid(VALID.replace("factor: 0.40", "factor: 0"), "procurador: factor must be");
        assertInvalid(VALID.replace("factor: 1.40", "factor: 0.90"), "sponsorAndAttorney: factor must be");
    }

    @Test
    void shouldRejectAMissingSectionOrMissingText() {
        assertInvalid(VALID.replace("scale: {article: art. 7, minPercent: 11, maxPercent: 20, "
                + "losingPartyFloorFactor: 0.70, flags: [validar]}\n", ""), "scale is required");
        assertInvalid(VALID.replace("law: Ley Ficticia\n", ""), "law is required");
        assertInvalid(VALID.replace(", name: Uno", ""), "minimum 'uno': name is required");
        assertInvalid(VALID.substring(0, VALID.indexOf("minimums:")) + "minimums: []\n",
                "at least one minimum is required");
    }

    @Test
    void shouldReportEveryProblemAtOnce() {
        String broken = VALID.replace("code: dos", "code: uno").replace("jus: 10", "jus: 0");

        assertThatThrownBy(() -> loader.load(yaml(broken)))
                .isInstanceOf(InvalidFeeScaleException.class)
                .hasMessageContaining("duplicate code")
                .hasMessageContaining("jus must be greater than 0");
    }

    @Test
    void shouldRejectUnknownPropertiesAndEmptyFiles() {
        assertInvalid(VALID + "surprise: true\n", "cannot read fees.yml");
        assertInvalid("", "fees.yml is empty");
    }

    private void assertInvalid(String content, String problem) {
        assertThatThrownBy(() -> loader.load(yaml(content)))
                .isInstanceOf(InvalidFeeScaleException.class)
                .hasMessageContaining(problem);
    }

    private static Resource yaml(String content) {
        return new ByteArrayResource(content.getBytes(StandardCharsets.UTF_8), "fees test");
    }
}
