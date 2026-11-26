package ar.gestorpenal.fee;

import ar.gestorpenal.security.AuthenticatedUser;
import ar.gestorpenal.user.Role;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The JUS values of the firm (ADR-0040). Every member reads them; only the owner and lawyers enter,
 * archive or restore one. There is no edit and no delete.
 */
@Service
class JusValueService {

    /** Neuquén's zone in the tz database (UTC-3 all year), the same one the agenda uses. */
    static final ZoneId ZONE = ZoneId.of("America/Argentina/Salta");
    static final LocalDate FIRST_VALID_FROM = LocalDate.of(2000, 1, 1);

    private final JusValueRepository values;
    private final Clock clock;

    JusValueService(JusValueRepository values, Clock clock) {
        this.values = values;
        this.clock = clock;
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    @Transactional(readOnly = true)
    JusValueHistory history(boolean includeArchived) {
        List<JusValue> found = includeArchived
                ? values.findAllByOrderByValidFromDescCreatedAtDesc()
                : values.findAllByArchivedAtIsNullOrderByValidFromDescCreatedAtDesc();
        JusValueView current = values
                .findFirstByArchivedAtIsNullAndValidFromLessThanEqualOrderByValidFromDesc(today())
                .map(JusValueView::of)
                .orElse(null);
        return new JusValueHistory(current, found.stream().map(JusValueView::of).toList());
    }

    /** The value that applies on a day: the latest active one that started on or before it. */
    @Transactional(readOnly = true)
    Optional<JusValueRef> valueOn(LocalDate day) {
        return values.findFirstByArchivedAtIsNullAndValidFromLessThanEqualOrderByValidFromDesc(day)
                .map(jus -> new JusValueRef(jus.getValue(), jus.getValidFrom()));
    }

    @Transactional
    JusValueView create(AuthenticatedUser user, JusValueData data) {
        requireCanManage(user);
        checkDay(data.validFrom());
        requireFreeDay(data.validFrom());
        try {
            JusValue created = values.saveAndFlush(
                    JusValue.create(user.userId(), data.value(), data.validFrom(), clock.instant()));
            return JusValueView.of(created);
        } catch (DataIntegrityViolationException raced) {
            throw duplicateDay();
        }
    }

    @Transactional
    void archive(AuthenticatedUser user, UUID id) {
        requireCanManage(user);
        find(id).archive(clock.instant());
    }

    @Transactional
    void restore(AuthenticatedUser user, UUID id) {
        requireCanManage(user);
        JusValue jus = find(id);
        if (jus.isArchived()) {
            requireFreeDay(jus.getValidFrom());
            jus.restore();
            try {
                values.flush();
            } catch (DataIntegrityViolationException raced) {
                throw duplicateDay();
            }
        }
    }

    /** The day of a calculation: today when absent, and inside the range a JUS value can have. */
    LocalDate calculationDay(LocalDate requested) {
        if (requested == null) {
            return today();
        }
        if (requested.isBefore(FIRST_VALID_FROM) || requested.isAfter(today().plusYears(1))) {
            throw new InvalidFeeDataException(
                    "date", "La fecha tiene que estar entre el 1/1/2000 y un año desde hoy");
        }
        return requested;
    }

    private JusValue find(UUID id) {
        return values.findById(id).orElseThrow(() -> new FeeNotFoundException("No hay un valor del JUS " + id));
    }

    private void checkDay(LocalDate validFrom) {
        if (validFrom.isBefore(FIRST_VALID_FROM)) {
            throw new InvalidFeeDataException("validFrom", "La fecha de vigencia no puede ser anterior al 1/1/2000");
        }
        if (validFrom.isAfter(today().plusYears(1))) {
            throw new InvalidFeeDataException(
                    "validFrom", "La fecha de vigencia no puede estar a más de un año de hoy");
        }
    }

    private void requireFreeDay(LocalDate validFrom) {
        if (values.existsByArchivedAtIsNullAndValidFrom(validFrom)) {
            throw duplicateDay();
        }
    }

    /** Also covers two requests for the same day racing past the check into the unique index. */
    private static DuplicateJusValueException duplicateDay() {
        return new DuplicateJusValueException(
                "Ya hay un valor del JUS vigente desde esa fecha: archivá el anterior si te equivocaste");
    }

    private static void requireCanManage(AuthenticatedUser user) {
        if (user.role() != Role.OWNER && user.role() != Role.LAWYER) {
            throw new AccessDeniedException("Only the owner and lawyers can change the JUS values");
        }
    }
}
