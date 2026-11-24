package ar.gestorpenal.task;

import java.util.List;

/** One page of tasks; {@code page} starts at 0. */
record TaskPage(List<TaskView> items, int page, int size, long total) {}
