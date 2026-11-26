package ar.gestorpenal.fee;

import ar.gestorpenal.tenancy.TenantService;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The fees scale of the firm's jurisdiction and the stateless calculation over it (ADR-0040). Nothing
 * about a calculation is stored.
 */
@Service
class FeeService {

    private final FeeScales scales;
    private final TenantService tenants;
    private final JusValueService jusValues;

    FeeService(FeeScales scales, TenantService tenants, JusValueService jusValues) {
        this.scales = scales;
        this.tenants = tenants;
        this.jusValues = jusValues;
    }

    @Transactional(readOnly = true)
    FeeScaleView scale(String practiceArea) {
        return FeeScaleView.of(scaleOfFirm(), practiceArea);
    }

    @Transactional(readOnly = true)
    FeeCalculation calculate(CalculationRequest request) {
        FeeScale scale = scaleOfFirm();
        FeeMinimum minimum = scale.minimum(request.minimumCode())
                .orElseThrow(() -> new InvalidFeeDataException(
                        "minimumCode", "No conocemos el tipo de asunto " + request.minimumCode()));
        LocalDate day = jusValues.calculationDay(request.date());
        JusValueRef jus = jusValues.valueOn(day).orElseThrow(JusValueMissingException::new);
        FeeQuery query = new FeeQuery(
                request.amount(), request.lostEntirely(), request.roleOrDefault(), request.instanceOrDefault());
        return FeeCalculator.calculate(scale, minimum, jus, query);
    }

    private FeeScale scaleOfFirm() {
        return scales.of(tenants.currentJurisdictionCode())
                .orElseThrow(() -> new FeeNotFoundException("Tu jurisdicción todavía no tiene escala de honorarios"));
    }
}
