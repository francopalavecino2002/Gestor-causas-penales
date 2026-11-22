package ar.gestorpenal.deadline;

/** How a deadline rule counts its term (art. 79 of the CPP de Neuquén). */
enum Computation {
    /** Continuous hours from the triggering instant. */
    HOURS,
    /** Business days of the court calendar, from the day after the trigger. */
    BUSINESS_DAYS,
    /** Calendar days (corridos), as for precautionary measures, from the day after the trigger. */
    CALENDAR_DAYS,
    /** Calendar months, date to date; a missing day is the last day of the month. */
    MONTHS,
    /** Calendar years, date to date. */
    YEARS,
    /** A judicial deadline: the judge or the prosecutor sets the date and the lawyer loads it. */
    SET_BY_COURT;

    boolean countsDays() {
        return this == BUSINESS_DAYS || this == CALENDAR_DAYS;
    }
}
