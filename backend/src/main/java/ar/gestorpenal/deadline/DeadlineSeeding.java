package ar.gestorpenal.deadline;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point the demo data uses to load deadlines without a logged-in user. It
 * trusts its caller (rule codes of the package, a defendant of the case) but still validates the
 * dates through the entity. Call it inside a tenant scope, outside any transaction.
 */
@Service
public class DeadlineSeeding {

    private final DeadlineRepository deadlines;
    private final FirmRules firmRules;
    private final DeadlineClock clock;

    DeadlineSeeding(DeadlineRepository deadlines, FirmRules firmRules, DeadlineClock clock) {
        this.deadlines = deadlines;
        this.firmRules = firmRules;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public boolean hasDeadlines(UUID caseId) {
        return !deadlines.findByCaseId(caseId).isEmpty();
    }

    /**
     * A deadline counted in days, months or years from {@code triggeredOn}; {@code setDueOn} only for a
     * judicial rule, {@code defendantId} only for a rule that runs per defendant.
     */
    @Transactional
    public UUID createDeadline(UUID caseId, UUID defendantId, String ruleCode, LocalDate triggeredOn, LocalDate setDueOn) {
        return createDeadline(caseId, defendantId, ruleCode, triggeredOn, setDueOn, null);
    }

    /** As {@link #createDeadline(UUID, UUID, String, LocalDate, LocalDate)}, with the lawyer's notes. */
    @Transactional
    public UUID createDeadline(
            UUID caseId, UUID defendantId, String ruleCode, LocalDate triggeredOn, LocalDate setDueOn, String notes) {
        DeadlineRule rule = firmRules.current().rule(ruleCode);
        DeadlineData data = new DeadlineData(ruleCode, defendantId, triggeredOn, null, setDueOn, null, null, notes);
        return deadlines.save(Deadline.create(caseId, defendantId, rule, data, DeadlineClock.ZONE, clock.today())).getId();
    }
}
