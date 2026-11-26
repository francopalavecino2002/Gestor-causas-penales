package ar.gestorpenal.fee;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.math.BigDecimal;
import java.util.List;

/**
 * The estimated fee range of a calculation, in pesos and in JUS, with every step and the review flags
 * of the rules it used. It is an assistance: the judge sets the fee and the lawyer controls it.
 */
record FeeCalculation(
        BigDecimal minPesos,
        BigDecimal maxPesos,
        BigDecimal minJus,
        BigDecimal maxJus,
        JusValueRef jusValue,
        FeeMinimum minimum,
        List<FeeStep> steps,
        List<ReviewFlag> flags,
        String disclaimer,
        String legalSource) {}
