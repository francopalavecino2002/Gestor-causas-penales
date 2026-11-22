package ar.gestorpenal.hearing;

import java.util.UUID;

/** A defendant or a lawyer as a hearing shows them: id and display name. */
record NamedRef(UUID id, String name) {}
