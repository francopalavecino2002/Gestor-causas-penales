package ar.gestorpenal.task;

/** Where a task stands: pendiente or hecha. Public so JPQL can name its constants. */
public enum TaskStatus {
    PENDING,
    DONE
}
