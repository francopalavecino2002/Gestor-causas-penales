package ar.gestorpenal.security;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Tenant-scoped (ADR-0007). Codes are never deleted: they are marked used or archived. */
interface RecoveryCodeRepository extends JpaRepository<RecoveryCode, UUID> {

    @Query("""
            select count(c) from RecoveryCode c
            where c.userId = :userId and c.usedAt is null and c.archivedAt is null""")
    long countUsable(@Param("userId") UUID userId);

    /**
     * Marks a usable code as used. A single conditional update, so a code works only once even
     * under concurrent requests.
     *
     * @return 1 if the code was usable, 0 otherwise
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update RecoveryCode c set c.usedAt = :now
            where c.userId = :userId and c.codeHash = :codeHash and c.usedAt is null and c.archivedAt is null""")
    int consume(@Param("userId") UUID userId, @Param("codeHash") String codeHash, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update RecoveryCode c set c.archivedAt = :now where c.userId = :userId and c.archivedAt is null")
    int archiveAll(@Param("userId") UUID userId, @Param("now") Instant now);
}
