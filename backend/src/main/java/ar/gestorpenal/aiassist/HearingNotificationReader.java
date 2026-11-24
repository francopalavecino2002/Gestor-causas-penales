package ar.gestorpenal.aiassist;

import java.util.List;

/**
 * Reads a court notification (OFIJU, SINE) and returns what it says about a hearing (ADR-0033). The
 * provider behind it is replaceable: the rest of the app only knows this interface.
 */
interface HearingNotificationReader {

    /**
     * @param notificationText the text the user pasted; untrusted, never stored
     * @param hearingTypes the hearing types the firm offers, so the provider can pick one by code
     * @throws AiProviderException when the provider cannot answer
     */
    RawHearingDraft read(String notificationText, List<HearingTypeOption> hearingTypes);

    record HearingTypeOption(String code, String name) {}

    /**
     * What the provider answered, before any check: every value may be missing or wrong. Date and
     * time are as written in the notification, in Neuquén's local time.
     */
    record RawHearingDraft(
            String typeCode,
            String date,
            String time,
            Integer durationMinutes,
            String room,
            String judge,
            String ofijuReference) {}
}
