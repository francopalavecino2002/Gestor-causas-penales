package ar.gestorpenal.jurisdiction;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * An optional feature a practice area turns on in its {@code area.yml} (ADR-0032). The core knows no
 * area: criminal concepts such as defendants or coercive measures are modules, and the endpoints
 * that serve them answer "module not enabled" for a case of an area that does not declare them.
 */
public enum PracticeModule {
    /** Defendants, each with their own stage, status and outcome (the criminal course of a case). */
    DEFENDANTS("defendants"),
    /** Coercive measures of a defendant; needs {@link #DEFENDANTS}. */
    COERCIVE_MEASURES("coercive-measures", DEFENDANTS),
    /** Alerts about detainees, computed from coercive measures; needs {@link #COERCIVE_MEASURES}. */
    DETAINEE_ALERTS("detainee-alerts", COERCIVE_MEASURES),
    /** Alternative ways to close a case (mediation, suspension of the trial). */
    ALTERNATIVE_OUTCOMES("alternative-outcomes"),
    /** The Ministerio Público Fiscal legajo number on the case. */
    MPF_LEGAJO("mpf-legajo");

    private final String id;
    private final List<PracticeModule> requires;

    PracticeModule(String id, PracticeModule... requires) {
        this.id = id;
        this.requires = List.of(requires);
    }

    @JsonValue
    public String id() {
        return id;
    }

    /** The modules an area must also declare for this one to make sense. */
    public List<PracticeModule> requires() {
        return requires;
    }

    public static Optional<PracticeModule> fromId(String id) {
        return Arrays.stream(values()).filter(module -> module.id.equals(id)).findFirst();
    }
}
