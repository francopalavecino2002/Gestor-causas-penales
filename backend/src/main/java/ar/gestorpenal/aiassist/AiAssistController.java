package ar.gestorpenal.aiassist;

import ar.gestorpenal.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** The optional AI assistance (ADR-0033): the firm's switch and the hearing draft from a notification. */
@RestController
class AiAssistController {

    private final AiAssistService assistance;

    AiAssistController(AiAssistService assistance) {
        this.assistance = assistance;
    }

    @GetMapping("/api/v1/ai-assist")
    AiAssistStatus status() {
        return assistance.status();
    }

    /** Owner only: the switch applies to the whole firm. */
    @PutMapping("/api/v1/ai-assist")
    AiAssistStatus change(
            @AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody AiAssistSettingData body) {
        return assistance.change(user, body.enabled());
    }

    /** A draft for the hearing form; nothing is saved and the text is not kept. */
    @PostMapping("/api/v1/cases/{caseId}/hearing-drafts")
    HearingDraft hearingDraft(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID caseId,
            @Valid @RequestBody HearingDraftRequest body) {
        return assistance.hearingDraft(user, caseId, body.text());
    }
}
