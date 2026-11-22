package ar.gestorpenal.hearing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The editable fields of a coercive measure, as sent by the client. {@code conditions} is the
 * measure's own data as free text (who, how often, where, which amount). {@code endsOn} is the fixed
 * duration (art. 116). Lifting a measure has its own endpoint. An update is a full replace.
 */
record CoerciveMeasureData(
        @NotBlank @Size(max = 60) String measureCode,
        @Size(max = 5000) String conditions,
        @Size(max = 200) String detentionPlace,
        List<@NotBlank @Size(max = 60) String> proceduralRiskCodes,
        @NotNull LocalDate startsOn,
        LocalDate endsOn,
        LocalDate nextReviewOn,
        UUID orderedByHearingId) {

    /** The risk codes without blanks or repeats, in the order given. */
    List<String> risks() {
        return proceduralRiskCodes == null
                ? List.of()
                : proceduralRiskCodes.stream().map(Text::clean).distinct().toList();
    }
}
