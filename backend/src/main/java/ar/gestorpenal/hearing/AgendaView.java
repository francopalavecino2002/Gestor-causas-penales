package ar.gestorpenal.hearing;

import java.time.LocalDate;
import java.util.List;

/** The hearings of a range of local days ({@code to} inclusive), in the firm's time zone. */
record AgendaView(LocalDate from, LocalDate to, String timeZone, List<AgendaItem> items) {}
