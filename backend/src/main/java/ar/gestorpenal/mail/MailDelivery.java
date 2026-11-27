package ar.gestorpenal.mail;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One email the system tried to send for a firm (ADR-0048): template, recipient, subject and outcome. The
 * body is never stored, since it can carry a one-time link. Written once and never changed; being
 * {@link Audited}, its creation is also the entry in the firm's history.
 */
@Entity
@Audited
@Table(name = "mail_delivery")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class MailDelivery extends TenantScopedEntity {

    static final int MAX_SUBJECT_LENGTH = 200;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, updatable = false, length = 60)
    private String template;

    @Column(nullable = false, updatable = false, length = 320)
    private String recipient;

    @Column(nullable = false, updatable = false, length = MAX_SUBJECT_LENGTH)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private MailOutcome outcome;

    @Column(name = "attempted_at", nullable = false, updatable = false)
    private Instant attemptedAt;

    static MailDelivery of(String template, String recipient, String subject, MailOutcome outcome, Instant now) {
        MailDelivery delivery = new MailDelivery();
        delivery.template = template;
        delivery.recipient = recipient;
        delivery.subject = subject.length() > MAX_SUBJECT_LENGTH ? subject.substring(0, MAX_SUBJECT_LENGTH) : subject;
        delivery.outcome = outcome;
        delivery.attemptedAt = now;
        return delivery;
    }
}
