package ar.gestorpenal.casefile;

import java.time.Instant;
import java.util.UUID;

/** The next hearing of a case, as its summary shows it. */
public record NextHearing(UUID id, Instant startsAt, String typeCode) {}
