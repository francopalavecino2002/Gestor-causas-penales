package ar.gestorpenal.aiassist;

import ar.gestorpenal.aiassist.AiAssistUse.Feature;
import ar.gestorpenal.aiassist.AiAssistUse.Outcome;
import ar.gestorpenal.aiassist.HearingNotificationReader.HearingTypeOption;
import ar.gestorpenal.aiassist.HearingNotificationReader.RawHearingDraft;
import ar.gestorpenal.casefile.CaseRef;
import ar.gestorpenal.casefile.Cases;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.CatalogService;
import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The optional AI assistance (ADR-0033). It only runs when the installation has a provider and the
 * firm's owner turned it on, it only sends the text the user pasted plus the names of the firm's
 * hearing types, and it never saves anything on its own: it returns a draft for the lawyer to review.
 */
@Service
@EnableConfigurationProperties(AiAssistProperties.class)
class AiAssistService {

    static final String PROVIDER = "Google Gemini";

    /**
     * Requests per firm and minute. Far above what a lawyer types, low enough that a loop (or a stolen
     * session) cannot burn the provider's quota for the whole installation.
     */
    static final int MAX_REQUESTS_PER_MINUTE = 10;

    private final AiAssistProperties properties;
    private final AiAssistSettingRepository settings;
    private final AiAssistUseRepository uses;
    private final HearingNotificationReader reader;
    private final Cases cases;
    private final CatalogService catalogs;
    private final Clock clock;

    AiAssistService(
            AiAssistProperties properties,
            AiAssistSettingRepository settings,
            AiAssistUseRepository uses,
            HearingNotificationReader reader,
            Cases cases,
            CatalogService catalogs,
            Clock clock) {
        this.properties = properties;
        this.settings = settings;
        this.uses = uses;
        this.reader = reader;
        this.cases = cases;
        this.catalogs = catalogs;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    AiAssistStatus status() {
        return new AiAssistStatus(properties.configured(), firmEnabled(), PROVIDER);
    }

    @Transactional
    AiAssistStatus change(AuthenticatedUser user, boolean enabled) {
        if (user.role() != Role.OWNER) {
            throw new AccessDeniedException("Only the firm owner can turn the AI assistance on or off");
        }
        settings.findFirstBy().ifPresentOrElse(
                setting -> setting.change(enabled), () -> settings.save(AiAssistSetting.create(enabled, clock.instant())));
        settings.flush();
        return new AiAssistStatus(properties.configured(), enabled, PROVIDER);
    }

    /**
     * Any member who can see the case may ask for a draft: it saves nothing, and saving the hearing
     * goes through the usual hearing permissions. Not transactional on purpose: no database transaction stays open while the provider answers,
     * and the usage row is kept even when the provider fails.
     */
    HearingDraft hearingDraft(AuthenticatedUser user, UUID caseId, String notificationText) {
        if (!properties.configured()) {
            throw new AiAssistUnavailableException();
        }
        if (!firmEnabled()) {
            throw new AiAssistDisabledException();
        }
        if (uses.countByUsedAtAfter(clock.instant().minus(Duration.ofMinutes(1))) >= MAX_REQUESTS_PER_MINUTE) {
            throw new AiAssistRateLimitedException();
        }
        CaseRef caseRef = cases.findVisible(user, caseId).orElseThrow(AiCaseNotFoundException::new);
        List<HearingTypeOption> types = catalogs.view(caseRef.practiceArea(), Catalog.HEARING_TYPES, false).items()
                .stream()
                .map(item -> new HearingTypeOption(item.code(), item.name()))
                .toList();
        RawHearingDraft raw;
        try {
            raw = reader.read(notificationText, types);
        } catch (AiProviderException exception) {
            record(user, caseId, Outcome.FAILED);
            throw exception;
        }
        record(user, caseId, Outcome.SUCCEEDED);
        return HearingDrafts.checked(raw, types);
    }

    private boolean firmEnabled() {
        return settings.findFirstBy().map(AiAssistSetting::isEnabled).orElse(false);
    }

    private void record(AuthenticatedUser user, UUID caseId, Outcome outcome) {
        uses.save(AiAssistUse.of(user.userId(), Feature.HEARING_FROM_NOTIFICATION, caseId, outcome, clock.instant()));
    }
}
