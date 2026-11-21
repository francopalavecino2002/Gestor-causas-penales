package ar.gestorpenal.audit;

import org.hibernate.event.spi.PreDeleteEvent;
import org.hibernate.event.spi.PreDeleteEventListener;
import org.springframework.stereotype.Component;

/**
 * Nothing is deleted, it is archived (ADR-0010). Rejects {@code remove()} of any entity before
 * Hibernate issues the {@code DELETE}, so the transaction rolls back instead of losing data.
 */
@Component
class DeletionGuard implements PreDeleteEventListener {

    @Override
    public boolean onPreDelete(PreDeleteEvent event) {
        throw new ArchiveInsteadOfDeleteException(event.getPersister().getMappedClass());
    }
}
