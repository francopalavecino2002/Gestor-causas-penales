package ar.gestorpenal.casefile;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Tenant-scoped by Hibernate: every query only sees the current firm's rows (ADR-0007). */
interface CaseFileRepository extends JpaRepository<CaseFile, UUID> {

    Optional<CaseFile> findByMpfLegajo(String mpfLegajo);

    Optional<CaseFile> findByInternalNumber(String internalNumber);

    /**
     * Cases the user may see that match the text: caption, internal number or OFIJU number
     * ({@code textPattern}, a lower-case SQL LIKE pattern) or MPF legajo ({@code legajoPattern},
     * uppercase). A reserved case is returned only to {@code seesEveryCase} (the owner) or to its
     * active team members; the filter is part of the query so the page and the total are right.
     */
    @Query("""
            select c from CaseFile c
            where (:includeArchived = true or c.archivedAt is null)
              and (:seesEveryCase = true or c.reserved = false
                   or exists (select 1 from CaseTeamMember m
                              where m.caseId = c.id and m.userId = :userId and m.archivedAt is null))
              and (lower(c.caption) like :textPattern
                   or lower(coalesce(c.internalNumber, '')) like :textPattern
                   or lower(coalesce(c.ofijuNumber, '')) like :textPattern
                   or coalesce(c.mpfLegajo, '') like :legajoPattern)
            order by c.createdAt desc, c.id
            """)
    Page<CaseFile> search(
            @Param("textPattern") String textPattern,
            @Param("legajoPattern") String legajoPattern,
            @Param("includeArchived") boolean includeArchived,
            @Param("seesEveryCase") boolean seesEveryCase,
            @Param("userId") UUID userId,
            Pageable pageable);
}
