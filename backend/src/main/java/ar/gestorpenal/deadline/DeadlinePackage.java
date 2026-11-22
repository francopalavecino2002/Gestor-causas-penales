package ar.gestorpenal.deadline;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The deadline rules and the court calendar of one jurisdiction (ADR-0017), read once at startup
 * from {@code resources/jurisdictions/<code>/} and shared, read-only, by every firm of it.
 *
 * @param law the code of procedure, the source of every rule that names no law of its own
 */
record DeadlinePackage(String jurisdictionCode, String law, String source, List<DeadlineRule> rules, CourtCalendar calendar) {

    DeadlinePackage {
        rules = List.copyOf(rules);
    }

    /** A jurisdiction that ships no rules: nothing to compute, every year unknown. */
    static DeadlinePackage empty(String jurisdictionCode) {
        return new DeadlinePackage(
                jurisdictionCode, null, null, List.of(), new CourtCalendar(Set.of(), Map.of(), null, List.of()));
    }

    Optional<DeadlineRule> rule(String code) {
        return rules.stream().filter(rule -> rule.code().equals(code)).findFirst();
    }

    /** "Art. 158; 160 inc. 7 · CPP de Neuquén (Ley 2784)", or the rule's own law alone when it has no article. */
    String sourceOf(DeadlineRule rule) {
        String ruleLaw = rule.law() == null ? law : rule.law();
        return rule.article() == null ? ruleLaw : "Art. " + rule.article() + " · " + ruleLaw;
    }
}
