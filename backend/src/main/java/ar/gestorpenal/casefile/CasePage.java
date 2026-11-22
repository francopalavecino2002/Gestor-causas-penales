package ar.gestorpenal.casefile;

import java.util.List;

/** One page of search results; {@code page} starts at 0. */
record CasePage(List<CaseView> items, int page, int size, long total) {}
