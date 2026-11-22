package ar.gestorpenal.deadline;

import ar.gestorpenal.deadline.CourtCalendar.NonBusinessDay;
import ar.gestorpenal.jurisdiction.ReviewFlag;
import java.util.List;

/**
 * The non-business days of one year (weekends are not listed).
 *
 * @param loaded whether the package has the year; when not, business-day deadlines reaching it are
 *     not calculable
 */
record CourtCalendarView(int year, boolean loaded, String source, List<ReviewFlag> flags, List<NonBusinessDay> days) {}
