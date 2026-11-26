package ar.gestorpenal.fee;

import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * The fee estimate of ADR-0040, step by step: the range over the amount (art. 7), raised to the
 * minimum in JUS (art. 9), the role (art. 10) and the instance (art. 15). Everything is a
 * {@link BigDecimal} and nothing is rounded until the end; the steps show cents for reading only.
 * It does not apply the art. 6 criteria, stages, interest or VAT.
 */
final class FeeCalculator {

    static final String DISCLAIMER = "Cálculo asistido: verificá con la norma";

    private static final int CENTS = 2;
    private static final int PERCENT_DIGITS = 2;
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private FeeCalculator() {}

    static FeeCalculation calculate(FeeScale scale, FeeMinimum minimum, JusValueRef jus, FeeQuery query) {
        List<FeeStep> steps = new ArrayList<>();
        Set<ReviewFlag> flags = new LinkedHashSet<>();
        BigDecimal minPesos = minimum.jus().multiply(jus.value());
        BigDecimal low = null;
        BigDecimal high = null;

        if (query.amount() != null) {
            FeeScale.Percentages percentages = scale.scale();
            BigDecimal minPercent = query.clientLostEntirely()
                    ? percentages.minPercent().multiply(percentages.losingPartyFloorFactor())
                    : percentages.minPercent();
            low = percentOf(query.amount(), minPercent);
            high = percentOf(query.amount(), percentages.maxPercent());
            String reason = query.clientLostEntirely() ? ", porque tu cliente perdió todo" : "";
            steps.add(new FeeStep(
                    "Escala sobre el monto de " + pesos(query.amount()) + ": del " + plain(minPercent) + "% al "
                            + plain(percentages.maxPercent()) + "%" + reason,
                    percentages.article(), cents(low), cents(high)));
            flags.addAll(percentages.flags());
        }

        steps.add(new FeeStep(
                "Mínimo de " + plain(minimum.jus()) + " JUS (" + minimum.name() + ") por el valor del JUS de "
                        + pesos(jus.value()) + ", vigente desde el " + jus.validFrom().format(DAY),
                minimum.article(), cents(minPesos), null));
        flags.addAll(minimum.flags());

        if (query.amount() == null) {
            low = minPesos;
            high = minPesos;
            steps.add(new FeeStep(
                    "Sin monto, el honorario es el mínimo", minimum.article(), cents(minPesos), null));
        } else {
            boolean raised = low.compareTo(minPesos) < 0 || high.compareTo(minPesos) < 0;
            low = low.max(minPesos);
            high = high.max(minPesos);
            if (raised) {
                steps.add(new FeeStep(
                        "Lo que quedaba por debajo del mínimo se eleva al mínimo",
                        minimum.article(), cents(low), cents(high)));
            }
        }

        FeeScale.Factor factor = factorOf(scale, query.role());
        if (factor != null) {
            low = low.multiply(factor.factor());
            high = high.multiply(factor.factor());
            steps.add(new FeeStep(roleDescription(query.role(), factor), factor.article(), cents(low), cents(high)));
            flags.addAll(factor.flags());
        }

        if (query.instance() != FeeInstance.FIRST) {
            FeeScale.Appeal appeal = scale.appeal();
            boolean fullyRevoked = query.instance() == FeeInstance.APPEAL_FULLY_REVOKED;
            BigDecimal lowPercent = fullyRevoked ? appeal.fullyRevokedPercent() : appeal.minPercent();
            BigDecimal highPercent = fullyRevoked ? appeal.fullyRevokedPercent() : appeal.maxPercent();
            low = percentOf(low, lowPercent);
            high = percentOf(high, highPercent);
            String description = fullyRevoked
                    ? "Segunda instancia con todo revocado a favor del apelante: " + plain(highPercent)
                            + "% de lo regulado en primera"
                    : "Segunda instancia: del " + plain(lowPercent) + "% al " + plain(highPercent)
                            + "% de lo regulado en primera";
            steps.add(new FeeStep(description, appeal.article(), cents(low), cents(high)));
            flags.addAll(appeal.flags());
        }

        return new FeeCalculation(
                cents(low),
                cents(high),
                jusOf(low, jus.value()),
                jusOf(high, jus.value()),
                jus,
                minimum,
                List.copyOf(steps),
                List.copyOf(flags),
                DISCLAIMER,
                scale.law());
    }

    /** The multiplier of the role, or {@code null} when the base fee applies. */
    private static FeeScale.Factor factorOf(FeeScale scale, FeeRole role) {
        return switch (role) {
            case SPONSOR -> null;
            case ATTORNEY -> scale.procurador();
            case SPONSOR_AND_ATTORNEY -> scale.sponsorAndAttorney();
        };
    }

    private static String roleDescription(FeeRole role, FeeScale.Factor factor) {
        BigDecimal share = factor.factor().movePointRight(PERCENT_DIGITS);
        if (role == FeeRole.ATTORNEY) {
            return "Como apoderado (procurador) cobrás el " + plain(share) + "% del honorario del patrocinante";
        }
        BigDecimal extra = share.subtract(ONE_HUNDRED);
        return "Como apoderado y patrocinante a la vez cobrás el " + plain(share) + "% (100% + " + plain(extra)
                + "%)";
    }

    private static BigDecimal percentOf(BigDecimal base, BigDecimal percent) {
        return base.multiply(percent).movePointLeft(PERCENT_DIGITS);
    }

    private static BigDecimal cents(BigDecimal value) {
        return value.setScale(CENTS, RoundingMode.HALF_UP);
    }

    private static BigDecimal jusOf(BigDecimal pesos, BigDecimal jusValue) {
        return pesos.divide(jusValue, CENTS, RoundingMode.HALF_UP);
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString().replace('.', ',');
    }

    /** {@code $ 94.963,25}: dot for thousands and comma for cents, as in Argentina. */
    private static String pesos(BigDecimal value) {
        String text = cents(value).toPlainString();
        int dot = text.indexOf('.');
        String whole = text.substring(0, dot);
        StringBuilder grouped = new StringBuilder();
        for (int i = 0; i < whole.length(); i++) {
            if (i > 0 && (whole.length() - i) % 3 == 0) {
                grouped.append('.');
            }
            grouped.append(whole.charAt(i));
        }
        return "$ " + grouped + "," + text.substring(dot + 1);
    }
}
