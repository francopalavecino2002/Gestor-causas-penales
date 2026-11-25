package ar.gestorpenal.news;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A new post: short plain text. Bean Validation is a first guard; {@link FirmPost#create} has the rule. */
record PostData(@NotBlank @Size(max = FirmPost.MAX_BODY_LENGTH) String body) {}
