package ar.gestorpenal.fee;

import static org.assertj.core.api.Assertions.assertThat;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** The calculation of ADR-0040 over the real Neuquén scale, with a JUS of $ 100 to keep the numbers readable. */
class FeeCalculatorTests {

    private static final FeeScale SCALE = new FeeScaleLoader().load(new ClassPathResource("jurisdictions/neuquen/fees.yml"));
    private static final JusValueRef JUS = new JusValueRef(new BigDecimal("100.00"), LocalDate.of(2026, 7, 1));
    /** 10 JUS, so $ 1.000 with the JUS above. */
    private static final FeeMinimum KNOWLEDGE = SCALE.minimum("conocimiento").orElseThrow();

    @Test
    void shouldGiveTheScaleRangeWhenTheAmountIsAboveTheMinimum() {
        FeeCalculation result = calculate("100000", false, FeeRole.SPONSOR, FeeInstance.FIRST);

        assertThat(result.minPesos()).isEqualTo("11000.00");
        assertThat(result.maxPesos()).isEqualTo("20000.00");
        assertThat(result.minJus()).isEqualTo("110.00");
        assertThat(result.maxJus()).isEqualTo("200.00");
        assertThat(result.steps()).extracting(FeeStep::article).containsExactly("art. 7", "art. 9");
        assertThat(result.steps().get(0).amount()).isEqualTo("11000.00");
        assertThat(result.steps().get(0).amountTo()).isEqualTo("20000.00");
    }

    @Test
    void shouldRaiseTheRangeToTheMinimumWhenTheAmountIsBelowIt() {
        FeeCalculation result = calculate("4000", false, FeeRole.SPONSOR, FeeInstance.FIRST);

        assertThat(result.minPesos()).isEqualTo("1000.00");
        assertThat(result.maxPesos()).isEqualTo("1000.00");
        assertThat(result.minJus()).isEqualTo("10.00");
        assertThat(result.steps()).extracting(FeeStep::description).anyMatch(text -> text.contains("se eleva al mínimo"));
    }

    @Test
    void shouldRaiseOnlyTheLowerBoundWhenTheRangeCrossesTheMinimum() {
        FeeCalculation result = calculate("6000", false, FeeRole.SPONSOR, FeeInstance.FIRST);

        assertThat(result.minPesos()).isEqualTo("1000.00");
        assertThat(result.maxPesos()).isEqualTo("1200.00");
    }

    @Test
    void shouldGiveTheMinimumWhenThereIsNoAmount() {
        FeeCalculation result = calculate(null, false, FeeRole.SPONSOR, FeeInstance.FIRST);

        assertThat(result.minPesos()).isEqualTo("1000.00");
        assertThat(result.maxPesos()).isEqualTo("1000.00");
        assertThat(result.minJus()).isEqualTo("10.00");
        assertThat(result.maxJus()).isEqualTo("10.00");
        assertThat(result.steps()).extracting(FeeStep::article).containsOnly("art. 9");
    }

    @Test
    void shouldLowerTheFloorTo7Point7PercentWhenTheClientLostEntirely() {
        FeeCalculation result = calculate("100000", true, FeeRole.SPONSOR, FeeInstance.FIRST);

        assertThat(result.minPesos()).isEqualTo("7700.00");
        assertThat(result.maxPesos()).isEqualTo("20000.00");
        assertThat(result.steps().get(0).description()).contains("7,7% al 20%").contains("perdió todo");
    }

    @Test
    void shouldGive40PercentToTheProcurador() {
        FeeCalculation result = calculate("100000", false, FeeRole.ATTORNEY, FeeInstance.FIRST);

        assertThat(result.minPesos()).isEqualTo("4400.00");
        assertThat(result.maxPesos()).isEqualTo("8000.00");
        assertThat(result.steps()).extracting(FeeStep::article).endsWith("art. 10");
    }

    @Test
    void shouldGive140PercentToWhoIsSponsorAndAttorney() {
        FeeCalculation result = calculate("100000", false, FeeRole.SPONSOR_AND_ATTORNEY, FeeInstance.FIRST);

        assertThat(result.minPesos()).isEqualTo("15400.00");
        assertThat(result.maxPesos()).isEqualTo("28000.00");
        assertThat(result.steps().get(result.steps().size() - 1).description()).contains("140%").contains("100% + 40%");
    }

    @Test
    void shouldGiveBetween25And35PercentOfTheFirstInstanceOnAppeal() {
        FeeCalculation result = calculate("100000", false, FeeRole.SPONSOR, FeeInstance.APPEAL);

        assertThat(result.minPesos()).isEqualTo("2750.00");
        assertThat(result.maxPesos()).isEqualTo("7000.00");
        assertThat(result.steps()).extracting(FeeStep::article).endsWith("art. 15");
    }

    @Test
    void shouldGive35PercentOfBothBoundsWhenEverythingWasRevoked() {
        FeeCalculation result = calculate("100000", false, FeeRole.SPONSOR, FeeInstance.APPEAL_FULLY_REVOKED);

        assertThat(result.minPesos()).isEqualTo("3850.00");
        assertThat(result.maxPesos()).isEqualTo("7000.00");
    }

    @Test
    void shouldApplyTheRoleBeforeTheAppeal() {
        FeeCalculation result = calculate("100000", false, FeeRole.ATTORNEY, FeeInstance.APPEAL);

        // 4.400 and 8.000 for the procurador, then 25% and 35%.
        assertThat(result.minPesos()).isEqualTo("1100.00");
        assertThat(result.maxPesos()).isEqualTo("2800.00");
    }

    @Test
    void shouldRoundHalfUpToCentsOnlyAtTheEnd() {
        FeeCalculation result = calculate("33333.33", false, FeeRole.SPONSOR, FeeInstance.FIRST);

        // 3666.6663 and 6666.666, and 36.666663 and 66.66666 JUS.
        assertThat(result.minPesos()).isEqualTo("3666.67");
        assertThat(result.maxPesos()).isEqualTo("6666.67");
        assertThat(result.minJus()).isEqualTo("36.67");
        assertThat(result.maxJus()).isEqualTo("66.67");
    }

    @Test
    void shouldShowTheJusValueItsDayAndTheFlagsOfTheRulesItUsed() {
        JusValueRef jus = new JusValueRef(new BigDecimal("94963.25"), LocalDate.of(2026, 7, 1));

        FeeCalculation result = FeeCalculator.calculate(
                SCALE, KNOWLEDGE, jus, new FeeQuery(null, false, FeeRole.SPONSOR, FeeInstance.FIRST));

        assertThat(result.minPesos()).isEqualTo("949632.50");
        assertThat(result.jusValue()).isEqualTo(jus);
        assertThat(result.minimum().code()).isEqualTo("conocimiento");
        assertThat(result.flags()).containsExactly(ReviewFlag.VALIDAR);
        assertThat(result.disclaimer()).isEqualTo("Cálculo asistido: verificá con la norma");
        assertThat(result.legalSource()).isEqualTo("Ley 1594");
        assertThat(result.steps().get(0).description()).contains("$ 94.963,25").contains("01/07/2026");
    }

    private static FeeCalculation calculate(String amount, boolean lost, FeeRole role, FeeInstance instance) {
        BigDecimal value = amount == null ? null : new BigDecimal(amount);
        return FeeCalculator.calculate(SCALE, KNOWLEDGE, JUS, new FeeQuery(value, lost, role, instance));
    }
}
