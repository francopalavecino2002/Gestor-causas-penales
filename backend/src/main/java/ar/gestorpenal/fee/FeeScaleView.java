package ar.gestorpenal.fee;

import java.util.List;

/**
 * The fees scale of the firm's jurisdiction for the screen: the rules, the minimums that apply, where
 * the JUS value is published and the disclaimer. A minimum with no {@code areas} applies to every area.
 */
record FeeScaleView(
        String law,
        String source,
        String jusSource,
        String disclaimer,
        FeeScale.Percentages scale,
        FeeScale.Factor procurador,
        FeeScale.Factor sponsorAndAttorney,
        FeeScale.Appeal appeal,
        List<FeeMinimum> minimums) {

    static final String JUS_SOURCE = "https://www.jusneuquen.gov.ar/valor-jus/";

    static FeeScaleView of(FeeScale scale, String practiceArea) {
        List<FeeMinimum> minimums = practiceArea == null
                ? scale.minimums()
                : scale.minimums().stream().filter(minimum -> minimum.appliesTo(practiceArea)).toList();
        return new FeeScaleView(
                scale.law(),
                scale.source(),
                JUS_SOURCE,
                FeeCalculator.DISCLAIMER,
                scale.scale(),
                scale.procurador(),
                scale.sponsorAndAttorney(),
                scale.appeal(),
                minimums);
    }
}
