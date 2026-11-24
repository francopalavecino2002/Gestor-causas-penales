package ar.gestorpenal.hearing;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Writes an iCalendar object (RFC 5545) by hand: the format is small and a library would add a
 * dependency for a few lines. Times are written in UTC, so no {@code VTIMEZONE} is needed; every
 * calendar app shows them in the viewer's zone. Lines end in CRLF and are folded at 75 octets.
 */
final class IcsWriter {

    static final String PRODUCT_ID = "-//Gestor de causas//Agenda de audiencias//ES";

    private static final String CRLF = "\r\n";
    private static final int MAX_LINE_OCTETS = 75;
    private static final DateTimeFormatter UTC_DATE_TIME =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    /** Controls other than tab and line breaks (RFC 5545 §3.3.11 excludes them from TEXT). */
    private static final Pattern CONTROL_CHARACTERS = Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]");

    /** How an event is shown: a cancelled event is removed or struck out by the calendar app. */
    enum Status {
        TENTATIVE,
        CONFIRMED,
        CANCELLED
    }

    /** One event; {@code location} and {@code description} may be {@code null}. */
    record Event(
            UUID id, Instant startsAt, Instant endsAt, String summary, String location, String description, Status status) {}

    private IcsWriter() {}

    /**
     * A {@code VCALENDAR} with the events in the order given. {@code stamp} is when it was generated
     * ({@code DTSTAMP}); the refresh hints ask subscribed calendars to come back every hour.
     */
    static String calendar(String name, String timeZoneId, Instant stamp, List<Event> events) {
        StringBuilder out = new StringBuilder();
        line(out, "BEGIN:VCALENDAR");
        line(out, "VERSION:2.0");
        line(out, "PRODID:" + PRODUCT_ID);
        line(out, "CALSCALE:GREGORIAN");
        line(out, "METHOD:PUBLISH");
        line(out, "X-WR-CALNAME:" + escape(name));
        line(out, "X-WR-TIMEZONE:" + timeZoneId);
        line(out, "REFRESH-INTERVAL;VALUE=DURATION:PT1H");
        line(out, "X-PUBLISHED-TTL:PT1H");
        for (Event event : events) {
            line(out, "BEGIN:VEVENT");
            line(out, "UID:" + event.id() + "@gestor-causas");
            line(out, "DTSTAMP:" + UTC_DATE_TIME.format(stamp));
            line(out, "DTSTART:" + UTC_DATE_TIME.format(event.startsAt()));
            line(out, "DTEND:" + UTC_DATE_TIME.format(event.endsAt()));
            line(out, "SUMMARY:" + escape(event.summary()));
            if (event.location() != null) {
                line(out, "LOCATION:" + escape(event.location()));
            }
            if (event.description() != null) {
                line(out, "DESCRIPTION:" + escape(event.description()));
            }
            line(out, "STATUS:" + event.status().name());
            line(out, "TRANSP:OPAQUE");
            line(out, "END:VEVENT");
        }
        line(out, "END:VCALENDAR");
        return out.toString();
    }

    /**
     * A TEXT value (RFC 5545 §3.3.11): backslash, semicolon, comma and line breaks are escaped, and
     * the other control characters, which a TEXT value may not hold, are dropped.
     */
    static String escape(String text) {
        return CONTROL_CHARACTERS.matcher(text).replaceAll("")
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r\n", "\n")
                .replace("\r", "\n")
                .replace("\n", "\\n");
    }

    /**
     * Splits a content line into lines of at most 75 octets of UTF-8 (RFC 5545 §3.1); each
     * continuation starts with a space. A character is never split across two lines.
     */
    static String fold(String contentLine) {
        StringBuilder out = new StringBuilder();
        int octets = 0;
        int index = 0;
        while (index < contentLine.length()) {
            int codePoint = contentLine.codePointAt(index);
            String character = new String(Character.toChars(codePoint));
            int size = character.getBytes(StandardCharsets.UTF_8).length;
            if (octets + size > MAX_LINE_OCTETS) {
                out.append(CRLF).append(' ');
                octets = 1;
            }
            out.append(character);
            octets += size;
            index += Character.charCount(codePoint);
        }
        return out.toString();
    }

    private static void line(StringBuilder out, String contentLine) {
        out.append(fold(contentLine)).append(CRLF);
    }
}
