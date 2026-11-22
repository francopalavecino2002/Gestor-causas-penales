package ar.gestorpenal.casefile;

import java.util.UUID;

/** A charge of a defendant. */
record ChargeView(UUID id, String offence, String legalReference) {

    static ChargeView of(DefendantCharge charge) {
        return new ChargeView(charge.getId(), charge.getOffence(), charge.getLegalReference());
    }
}
