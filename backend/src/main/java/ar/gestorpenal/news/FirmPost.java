package ar.gestorpenal.news;

import ar.gestorpenal.audit.Audited;
import ar.gestorpenal.tenancy.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * A short manual post on the firm's news wall (ADR-0038). It is not edited: it is archived, never
 * deleted. Being {@link Audited}, its creation is the audit entry the wall lists.
 */
@Entity
@Audited
@Table(name = "firm_post")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
class FirmPost extends TenantScopedEntity {

    static final int MAX_BODY_LENGTH = 1000;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = MAX_BODY_LENGTH)
    private String body;

    @Column(name = "author_user_id", nullable = false, updatable = false)
    private UUID authorUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    static FirmPost create(UUID authorUserId, String body, Instant now) {
        String clean = body == null || body.isBlank() ? null : body.strip();
        if (clean == null) {
            throw new InvalidPostException("The post needs a text");
        }
        if (clean.length() > MAX_BODY_LENGTH) {
            throw new InvalidPostException("The post can have at most " + MAX_BODY_LENGTH + " characters");
        }
        FirmPost post = new FirmPost();
        post.authorUserId = authorUserId;
        post.body = clean;
        post.createdAt = now;
        return post;
    }

    void archive(Instant now) {
        if (archivedAt == null) {
            archivedAt = now;
        }
    }

    void restore() {
        archivedAt = null;
    }
}
