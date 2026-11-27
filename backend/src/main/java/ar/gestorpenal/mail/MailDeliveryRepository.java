package ar.gestorpenal.mail;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/** Tenant-scoped (ADR-0007). Rows are only added: there is no update or delete. */
interface MailDeliveryRepository extends Repository<MailDelivery, UUID> {

    MailDelivery save(MailDelivery delivery);

    long countByTemplateAndAttemptedAtAfter(String template, Instant since);

    List<MailDelivery> findAllByOrderByAttemptedAtDesc();
}
