package ar.gestorpenal.aiassist;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The notification text the user pasted. */
record HearingDraftRequest(@NotBlank @Size(max = HearingDraftRequest.TEXT_MAX) String text) {

    static final int TEXT_MAX = 20_000;
}
