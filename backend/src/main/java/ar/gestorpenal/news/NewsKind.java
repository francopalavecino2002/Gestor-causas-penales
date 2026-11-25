package ar.gestorpenal.news;

/** What an entry of the firm's news wall is about. */
enum NewsKind {
    CASE_OPENED,
    HEARING_SCHEDULED,
    HEARING_RESCHEDULED,
    /** A hearing was held (also reconverted or in recess) and its result was loaded. */
    HEARING_RESULT,
    POST
}
