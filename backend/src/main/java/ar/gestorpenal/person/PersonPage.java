package ar.gestorpenal.person;

import java.util.List;

/** One page of search results; {@code page} starts at 0. */
record PersonPage(List<PersonListItem> items, int page, int size, long total) {}
