package ar.gestorpenal.audit;

/** Thrown when code tries to delete an entity: records are archived, never deleted. */
public class ArchiveInsteadOfDeleteException extends UnsupportedOperationException {

    ArchiveInsteadOfDeleteException(Class<?> entityClass) {
        super(entityClass.getSimpleName() + " records are never deleted: archive them instead");
    }
}
