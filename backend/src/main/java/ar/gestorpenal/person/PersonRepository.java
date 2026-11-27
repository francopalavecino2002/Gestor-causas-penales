package ar.gestorpenal.person;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Tenant-scoped by Hibernate: every query only sees the current firm's rows (ADR-0007). */
interface PersonRepository extends JpaRepository<Person, UUID> {

    Optional<Person> findByDocumentTypeAndDocumentNumber(DocumentType documentType, String documentNumber);

    Optional<Person> findFirstByFirstNamesAndLastNamesOrderByCreatedAtAscIdAsc(String firstNames, String lastNames);

    Optional<Person> findFirstByKindAndLegalNameOrderByCreatedAtAscIdAsc(PersonKind kind, String legalName);

    /**
     * Search by name, legal name or alias ({@code namePattern}) or by document number
     * ({@code numberPattern}); both are SQL LIKE patterns in lower and upper case respectively.
     */
    @Query("""
            select p from Person p
            where (:includeArchived = true or p.archivedAt is null)
              and (lower(concat(coalesce(p.firstNames, ''), ' ', coalesce(p.lastNames, ''), ' ',
                                coalesce(p.legalName, ''), ' ', coalesce(p.aliases, ''))) like :namePattern
                   or p.documentNumber like :numberPattern)
            order by lower(coalesce(p.lastNames, p.legalName)), p.id
            """)
    Page<Person> search(
            @Param("namePattern") String namePattern,
            @Param("numberPattern") String numberPattern,
            @Param("includeArchived") boolean includeArchived,
            Pageable pageable);

    /** Archived people included: a conflict must show up even if the file was closed long ago. */
    @Query("""
            select p from Person p
            where p.documentNumber in :numbers
               or (p.documentType in (ar.gestorpenal.person.DocumentType.CUIT, ar.gestorpenal.person.DocumentType.CUIL)
                   and length(p.documentNumber) = 11 and substring(p.documentNumber, 3, 8) = :embeddedDni)
            order by p.createdAt, p.id
            """)
    List<Person> findByDocument(
            @Param("numbers") Collection<String> numbers, @Param("embeddedDni") String embeddedDni);
}
