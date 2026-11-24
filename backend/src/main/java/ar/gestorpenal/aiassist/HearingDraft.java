package ar.gestorpenal.aiassist;

import java.util.List;

/**
 * A hearing pre-filled from a notification, for the lawyer to review before saving. Nothing is saved
 * by this: the client fills the hearing form with it.
 *
 * @param typeCode an offered item of the case's hearing types, or {@code null}
 * @param date {@code yyyy-MM-dd}, Neuquén time, or {@code null}
 * @param time {@code HH:mm}, Neuquén time, or {@code null}
 * @param missing the fields above that could not be read, by name
 */
record HearingDraft(
        String typeCode,
        String date,
        String time,
        Integer durationMinutes,
        String room,
        String judge,
        String ofijuReference,
        List<String> missing) {}
