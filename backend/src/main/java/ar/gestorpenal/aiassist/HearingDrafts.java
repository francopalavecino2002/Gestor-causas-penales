package ar.gestorpenal.aiassist;

import ar.gestorpenal.aiassist.HearingNotificationReader.HearingTypeOption;
import ar.gestorpenal.aiassist.HearingNotificationReader.RawHearingDraft;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Turns what the provider answered into a draft the hearing form accepts. Anything that does not fit
 * (a type the firm does not offer, an impossible date, an out-of-range duration, a text too long for
 * its field) is dropped and listed as missing, never guessed.
 */
final class HearingDrafts {

    static final int MIN_DURATION = 5;
    static final int MAX_DURATION = 1440;
    static final int ROOM_MAX = 100;
    static final int JUDGE_MAX = 200;
    static final int OFIJU_REFERENCE_MAX = 100;

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private HearingDrafts() {}

    static HearingDraft checked(RawHearingDraft raw, List<HearingTypeOption> offeredTypes) {
        List<String> missing = new ArrayList<>();
        String typeCode = offeredTypes.stream().map(HearingTypeOption::code)
                .filter(code -> code.equals(raw.typeCode())).findFirst().orElse(null);
        String date = date(raw.date());
        String time = time(raw.time());
        Integer duration = raw.durationMinutes() != null
                        && raw.durationMinutes() >= MIN_DURATION
                        && raw.durationMinutes() <= MAX_DURATION
                ? raw.durationMinutes()
                : null;
        String room = text(raw.room(), ROOM_MAX);
        String judge = text(raw.judge(), JUDGE_MAX);
        String ofijuReference = text(raw.ofijuReference(), OFIJU_REFERENCE_MAX);
        addIfNull(missing, "typeCode", typeCode);
        addIfNull(missing, "date", date);
        addIfNull(missing, "time", time);
        addIfNull(missing, "room", room);
        addIfNull(missing, "judge", judge);
        addIfNull(missing, "ofijuReference", ofijuReference);
        return new HearingDraft(typeCode, date, time, duration, room, judge, ofijuReference, List.copyOf(missing));
    }

    private static String date(String value) {
        if (value == null) {
            return null;
        }
        try {
            return LocalDate.parse(value.strip()).toString();
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private static String time(String value) {
        if (value == null) {
            return null;
        }
        try {
            return LocalTime.parse(value.strip()).format(TIME);
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private static String text(String value, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String stripped = value.strip();
        return stripped.length() <= max ? stripped : null;
    }

    private static void addIfNull(List<String> missing, String field, Object value) {
        if (value == null) {
            missing.add(field);
        }
    }
}
