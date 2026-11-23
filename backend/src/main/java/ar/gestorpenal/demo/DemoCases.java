package ar.gestorpenal.demo;

import static ar.gestorpenal.casefile.DefendantStatus.ACTIVE;
import static ar.gestorpenal.casefile.DefendantStatus.CLOSED;
import static ar.gestorpenal.casefile.DefendantStatus.IN_MEDIATION;
import static ar.gestorpenal.casefile.DefendantStatus.SUSPENDED;

import ar.gestorpenal.casefile.DefendantStatus;
import ar.gestorpenal.demo.DemoData.DemoPerson;
import ar.gestorpenal.demo.DemoData.DemoUser;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * The rich demo portfolio (T30): 23 fictitious cases on top of the two of {@link DemoData}, so the firm
 * has about 25 cases across every stage. Every date is relative to today: hearings in weekdays from
 * today ({@link DemoCalendar}), measures and deadlines in calendar days. Names carry a fictitious
 * surname (Ficticio, Ejemplo, Prueba, Demo) and nobody has a document number.
 *
 * <p>Hearing slots are 8:00, 13:00, 14:30 and 16:00, never between 9:00 and 12:30 where the first two
 * cases live, and no lawyer has two of them at once: the only clash of the demo stays the one of
 * DEMO-001 and DEMO-002.
 */
final class DemoCases {

    private static final DemoUser LUCIA = DemoData.OWNER;
    private static final DemoUser MARTIN = DemoData.LAWYER;
    private static final DemoUser JULIAN = DemoData.SECOND_LAWYER;

    private static final String CONFLUENCIA = "i-confluencia";
    private static final String COMARCA = "ii-comarca";
    private static final String VACA_MUERTA = "vi-vaca-muerta";

    private static final LocalTime EARLY = LocalTime.of(8, 0);
    private static final LocalTime AFTER_LUNCH = LocalTime.of(13, 0);
    private static final LocalTime AFTERNOON = LocalTime.of(14, 30);
    private static final LocalTime LATE = LocalTime.of(16, 0);

    private static final String DETENTION_PLACE = "Unidad de detención ficticia";

    static final List<CaseSpec> CASES = List.of(
            // Detainee whose preventive prison ends tomorrow: the first thing the agenda warns about.
            demoCase("DEMO-003", "Acosta Ficticio, Ramiro s/ robo con arma (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(active(person("Ramiro", "Acosta Ficticio"), "investigacion-preparatoria",
                            "Robo con arma", "CP art. 166 inc. 2", 60))
                    .measure(new MeasureSpec(0, "prision-preventiva", DETENTION_PLACE,
                            List.of("peligro-de-fuga", "entorpecimiento-de-la-investigacion"), 59, 1, 1))
                    .deadline(new DeadlineSpec(0, "duracion-fijada-prision-preventiva", 59, 1, null))
                    .deadline(new DeadlineSpec(0, "duracion-maxima-prision-preventiva", 59, null, null))
                    .deadline(new DeadlineSpec(0, "investigacion-preparatoria", 60, null, null))
                    // Today, so the hearing is always before the term ends, even on a Friday.
                    .hearing(new HearingSpec(0, LATE, 45, "revision-de-prision-preventiva", "Sala 2"))
                    .build(),
            // Three defendants; the detained one asked for a review four days ago (5 calendar days, art. 118).
            demoCase("DEMO-004", "Benítez Ejemplo, Carla y otros s/ homicidio (ficticio)", CONFLUENCIA, LUCIA)
                    .defendant(active(person("Carla", "Benítez Ejemplo"), "investigacion-preparatoria",
                            "Homicidio simple", "CP art. 79", 100))
                    .defendant(active(person("Diego", "Castro Prueba"), "investigacion-preparatoria",
                            "Homicidio simple (partícipe secundario)", "CP arts. 79 y 46", 100))
                    .defendant(active(person("Elena", "Duarte Ficticia"), "conclusion-de-la-investigacion",
                            "Encubrimiento", "CP art. 277", 100))
                    .measure(new MeasureSpec(0, "prision-preventiva", DETENTION_PLACE,
                            List.of("peligro-de-fuga"), 100, 80, 1))
                    .measure(new MeasureSpec(1, "presentacion-periodica", null, List.of(), 100, null, null))
                    .deadline(new DeadlineSpec(0, "revision-prision-preventiva", 4, null, null))
                    .deadline(new DeadlineSpec(0, "duracion-maxima-prision-preventiva", 100, null, null))
                    .hearing(new HearingSpec(0, EARLY, 45, "revision-de-prision-preventiva", "Sala 1", 0))
                    .hearing(new HearingSpec(3, AFTERNOON, 60, "control-de-la-investigacion", "Sala 3"))
                    .build(),
            // Alternative outcome in its probation period: a judicial deadline holds the probation term.
            demoCase("DEMO-005", "Ledesma Prueba, Hernán s/ hurto (ficticio)", CONFLUENCIA, JULIAN)
                    .defendant(new DefendantSpec(person("Hernán", "Ledesma Prueba"), "etapa-intermedia", SUSPENDED,
                            null, "Hurto", "CP art. 162", 400, null))
                    .deadline(new DeadlineSpec(null, "plazo-judicial", 240, 490,
                            "Suspensión de juicio a prueba (art. 108): plazo de prueba de 2 años. Reglas de conducta:"
                                    + " fijar domicilio y presentarse cada 60 días ante el juez de Ejecución. [validar]"))
                    .hearing(new HearingSpec(2, EARLY, 45, "ejecucion", "Sala 5"))
                    .build(),
            // Penal mediation running: the 60 calendar days of the mediation law.
            demoCase("DEMO-006", "Godoy Ejemplo, Lorena s/ amenazas (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(new DefendantSpec(person("Lorena", "Godoy Ejemplo"), "averiguacion-preliminar",
                            IN_MEDIATION, null, "Amenazas", "CP art. 149 bis", null, null))
                    .deadline(new DeadlineSpec(null, "mediacion-penal", 20, null, null))
                    .build(),
            demoCase("DEMO-007", "Ibáñez Demo, Pablo s/ lesiones graves (ficticio)", CONFLUENCIA, LUCIA)
                    .defendant(active(person("Pablo", "Ibáñez Demo"), "etapa-intermedia",
                            "Lesiones graves", "CP art. 90", 200))
                    .hearing(new HearingSpec(0, AFTER_LUNCH, 60, "control-de-acusacion", "Sala 2"))
                    .build(),
            demoCase("DEMO-008", "Juárez Ficticio, Mariano y Nieves Ejemplo, Rocío s/ estafa (ficticio)",
                            COMARCA, JULIAN)
                    .defendant(active(person("Mariano", "Juárez Ficticio"), "preparacion-del-juicio",
                            "Estafa", "CP art. 172", 300))
                    .defendant(active(person("Rocío", "Nieves Ejemplo"), "etapa-intermedia",
                            "Estafa (partícipe)", "CP arts. 172 y 46", 300))
                    .hearing(new HearingSpec(0, EARLY, 45, "preparacion-del-juicio", "Oficina Judicial", 0))
                    .hearing(new HearingSpec(4, AFTER_LUNCH, 60, "control-de-acusacion", "Sala 1", 1))
                    .build(),
            // A technical trial over two days.
            demoCase("DEMO-009", "Kessler Prueba, Andrés s/ abuso de arma (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(active(person("Andrés", "Kessler Prueba"), "juicio",
                            "Abuso de arma", "CP art. 104", 420))
                    .hearing(new HearingSpec(2, AFTER_LUNCH, 180, "juicio-tecnico", "Sala de juicio 1"))
                    .hearing(new HearingSpec(3, AFTER_LUNCH, 180, "juicio-tecnico", "Sala de juicio 1"))
                    .build(),
            demoCase("DEMO-010", "Lagos Ejemplo, Valeria s/ homicidio culposo (ficticio)", CONFLUENCIA, LUCIA)
                    .defendant(active(person("Valeria", "Lagos Ejemplo"), "determinacion-de-la-pena",
                            "Homicidio culposo", "CP art. 84", 500))
                    .hearing(new HearingSpec(2, AFTERNOON, 60, "determinacion-de-la-pena", "Sala de juicio 2"))
                    .build(),
            // A conviction notified yesterday: the ordinary appeal runs in business days.
            demoCase("DEMO-011", "Medina Demo, Sergio s/ robo (ficticio)", VACA_MUERTA, JULIAN)
                    .defendant(active(person("Sergio", "Medina Demo"), "impugnacion",
                            "Robo", "CP art. 164", 380))
                    .deadline(new DeadlineSpec(null, "impugnacion-ordinaria", 1, null, null))
                    .hearing(new HearingSpec(6, AFTER_LUNCH, 60, "impugnacion-ordinaria", "Tribunal de Impugnación"))
                    .build(),
            demoCase("DEMO-012", "Navarro Ficticio, Ezequiel s/ tenencia de arma (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(active(person("Ezequiel", "Navarro Ficticio"), "ejecucion",
                            "Tenencia ilegal de arma de fuego", "CP art. 189 bis", 700))
                    .hearing(new HearingSpec(1, AFTERNOON, 60, "ejecucion", "Sala 5"))
                    .build(),
            demoCase("DEMO-013", "Ortiz Prueba, Camila s/ daño (ficticio)", CONFLUENCIA, LUCIA)
                    .defendant(active(person("Camila", "Ortiz Prueba"), "averiguacion-preliminar",
                            "Daño", "CP art. 183", null))
                    .hearing(new HearingSpec(4, EARLY, 45, "formulacion-de-cargos", "Sala 4"))
                    .build(),
            // Three defendants arrested together; one belongs to an indigenous people ([validar], ADR-0014).
            demoCase("DEMO-014", "Peralta Ejemplo, Joaquín y otros s/ robo en poblado y en banda (ficticio)",
                            CONFLUENCIA, JULIAN)
                    .defendant(active(person("Joaquín", "Peralta Ejemplo"), "investigacion-preparatoria",
                            "Robo en poblado y en banda", "CP art. 167 inc. 2", 30))
                    .defendant(new DefendantSpec(person("Ulises", "Quiroga Demo"), "averiguacion-preliminar", ACTIVE,
                            null, "Robo en poblado y en banda", "CP art. 167 inc. 2", null, true))
                    .defendant(active(person("Agustina", "Reyes Ficticia"), "averiguacion-preliminar",
                            "Robo en poblado y en banda", "CP art. 167 inc. 2", null))
                    .hearing(new HearingSpec(0, AFTERNOON, 60, "formulacion-de-cargos", "Sala 3", 1, 2))
                    .hearing(new HearingSpec(0, LATE, 60, "detencion-y-medida-de-coercion", "Sala 3", 1, 2))
                    .build(),
            demoCase("DEMO-015", "Ramos Demo, Florencia s/ lesiones leves (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(active(person("Florencia", "Ramos Demo"), "investigacion-preparatoria",
                            "Lesiones leves", "CP art. 89", 90))
                    .deadline(new DeadlineSpec(0, "investigacion-preparatoria", 90, null, null))
                    .hearing(new HearingSpec(0, EARLY, 45, "suspension-de-juicio-a-prueba", "Sala 4"))
                    .build(),
            demoCase("DEMO-016", "Sosa Ficticia, Mónica s/ defraudación (ficticio)", COMARCA, LUCIA)
                    .defendant(active(person("Mónica", "Sosa Ficticia"), "conclusion-de-la-investigacion",
                            "Defraudación por retención indebida", "CP art. 173 inc. 2", 240))
                    .hearing(new HearingSpec(3, EARLY, 45, "peticion-de-sobreseimiento", "Sala 2"))
                    .build(),
            // A jury trial: jury selection this week, the trial next week.
            demoCase("DEMO-017", "Torres Ejemplo, Gonzalo s/ homicidio en grado de tentativa (ficticio)",
                            CONFLUENCIA, JULIAN)
                    .defendant(active(person("Gonzalo", "Torres Ejemplo"), "juicio",
                            "Homicidio en grado de tentativa", "CP arts. 79 y 42", 450))
                    .hearing(new HearingSpec(5, AFTER_LUNCH, 120, "seleccion-de-jurados", "Sala de juicio 2"))
                    .hearing(new HearingSpec(7, AFTER_LUNCH, 180, "juicio-por-jurados", "Sala de juicio 2"))
                    .build(),
            demoCase("DEMO-018", "Urquiza Prueba, Leandro s/ amenazas calificadas (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(active(person("Leandro", "Urquiza Prueba"), "investigacion-preparatoria",
                            "Amenazas calificadas", "CP art. 149 bis", 45))
                    .measure(new MeasureSpec(0, "prohibicion-de-salir-visitar-o-comunicarse", null,
                            List.of(), 45, null, null))
                    .hearing(new HearingSpec(4, AFTERNOON, 60, "modificacion-de-medidas-cautelares", "Sala 1"))
                    .build(),
            // The investigation term already ran out: an expired deadline in the list.
            demoCase("DEMO-019", "Vera Demo, Natalia s/ encubrimiento (ficticio)", VACA_MUERTA, LUCIA)
                    .defendant(active(person("Natalia", "Vera Demo"), "investigacion-preparatoria",
                            "Encubrimiento", "CP art. 277", 150))
                    .deadline(new DeadlineSpec(0, "investigacion-preparatoria", 150, null, null))
                    .hearing(new HearingSpec(1, LATE, 45, "prorroga-de-la-investigacion", "Sala 2"))
                    .build(),
            // Arrested two days ago, sent home under house arrest at yesterday's hearing.
            demoCase("DEMO-020", "Zapata Ficticio, Bruno s/ robo (ficticio)", CONFLUENCIA, JULIAN)
                    .defendant(active(person("Bruno", "Zapata Ficticio"), "averiguacion-preliminar",
                            "Robo", "CP art. 164", null))
                    .measure(new MeasureSpec(0, "detencion-domiciliaria", "Domicilio ficticio", List.of(), 1, null, null))
                    .hearing(new HearingSpec(-1, AFTER_LUNCH, 60, "detencion-y-medida-de-coercion", "Sala 3"))
                    .build(),
            demoCase("DEMO-021", "Aguirre Ejemplo, Facundo s/ hurto (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(closed(person("Facundo", "Aguirre Ejemplo"), "sobreseimiento", "Hurto", "CP art. 162"))
                    .build(),
            demoCase("DEMO-022", "Bustos Prueba, Daniela s/ lesiones leves (ficticio)", COMARCA, LUCIA)
                    .defendant(closed(person("Daniela", "Bustos Prueba"), "conciliacion-o-mediacion-cumplida",
                            "Lesiones leves", "CP art. 89"))
                    .build(),
            // One defendant closed by a plea agreement, the other one goes to trial.
            demoCase("DEMO-023", "Cabrera Demo, Iván y Domínguez Ficticio, Lautaro s/ robo (ficticio)",
                            CONFLUENCIA, JULIAN)
                    .defendant(closed(person("Iván", "Cabrera Demo"), "acuerdo-pleno", "Robo", "CP art. 164"))
                    .defendant(active(person("Lautaro", "Domínguez Ficticio"), "juicio",
                            "Robo", "CP art. 164", 330))
                    .hearing(new HearingSpec(-2, AFTERNOON, 60, "acuerdo-pleno-o-parcial", "Sala 4", 0))
                    .hearing(new HearingSpec(4, LATE, 60, "juicio-tecnico", "Sala de juicio 1", 1))
                    .build(),
            demoCase("DEMO-024", "Escobar Ejemplo, Paula s/ estafa (ficticio)", CONFLUENCIA, MARTIN)
                    .defendant(closed(person("Paula", "Escobar Ejemplo"), "absolucion", "Estafa", "CP art. 172"))
                    .build(),
            demoCase("DEMO-025", "Funes Prueba, Matías s/ homicidio (ficticio, reservada)", CONFLUENCIA, LUCIA)
                    .reserved()
                    .defendant(active(person("Matías", "Funes Prueba"), "etapa-intermedia",
                            "Homicidio simple", "CP art. 79", 260))
                    .hearing(new HearingSpec(2, LATE, 60, "control-de-acusacion", "Sala 2"))
                    .build());

    private DemoCases() {}

    private static DemoPerson person(String firstNames, String lastNames) {
        return new DemoPerson(firstNames, lastNames);
    }

    private static DefendantSpec active(
            DemoPerson person, String stage, String offence, String legalReference, Integer chargesDaysAgo) {
        return new DefendantSpec(person, stage, ACTIVE, null, offence, legalReference, chargesDaysAgo, null);
    }

    private static DefendantSpec closed(DemoPerson person, String outcome, String offence, String legalReference) {
        return new DefendantSpec(person, "cerrada", CLOSED, outcome, offence, legalReference, null, null);
    }

    private static CaseBuilder demoCase(String number, String caption, String circumscription, DemoUser responsible) {
        return new CaseBuilder(number, caption, circumscription, responsible);
    }

    /** A demo case: its defendants, and what refers to them by their position in that list. */
    record CaseSpec(
            String number,
            String caption,
            String circumscription,
            DemoUser responsible,
            boolean reserved,
            List<DefendantSpec> defendants,
            List<HearingSpec> hearings,
            List<MeasureSpec> measures,
            List<DeadlineSpec> deadlines) {}

    record DefendantSpec(
            DemoPerson person,
            String stage,
            DefendantStatus status,
            String closingOutcome,
            String offence,
            String legalReference,
            Integer chargesDaysAgo,
            Boolean indigenousPeople) {}

    /**
     * A hearing {@code weekday} weekdays from today, attended by the case's responsible lawyer.
     *
     * @param defendants positions of the defendants it is about; none means all of them
     */
    record HearingSpec(int weekday, LocalTime time, int minutes, String type, String room, int... defendants) {}

    /** A coercive measure; the review and end are days from today, the start days ago. */
    record MeasureSpec(
            int defendant,
            String code,
            String place,
            List<String> risks,
            int startedDaysAgo,
            Integer endsInDays,
            Integer reviewInDays) {}

    /**
     * A deadline that started {@code triggeredDaysAgo}; {@code dueInDays} only for a judicial one.
     *
     * @param defendant position of the defendant, or {@code null} for a rule that runs per case
     */
    record DeadlineSpec(Integer defendant, String rule, int triggeredDaysAgo, Integer dueInDays, String notes) {}

    private static final class CaseBuilder {

        private final String number;
        private final String caption;
        private final String circumscription;
        private final DemoUser responsible;
        private boolean reserved;
        private final List<DefendantSpec> defendants = new ArrayList<>();
        private final List<HearingSpec> hearings = new ArrayList<>();
        private final List<MeasureSpec> measures = new ArrayList<>();
        private final List<DeadlineSpec> deadlines = new ArrayList<>();

        private CaseBuilder(String number, String caption, String circumscription, DemoUser responsible) {
            this.number = number;
            this.caption = caption;
            this.circumscription = circumscription;
            this.responsible = responsible;
        }

        CaseBuilder reserved() {
            reserved = true;
            return this;
        }

        CaseBuilder defendant(DefendantSpec defendant) {
            defendants.add(defendant);
            return this;
        }

        CaseBuilder hearing(HearingSpec hearing) {
            hearings.add(hearing);
            return this;
        }

        CaseBuilder measure(MeasureSpec measure) {
            measures.add(measure);
            return this;
        }

        CaseBuilder deadline(DeadlineSpec deadline) {
            deadlines.add(deadline);
            return this;
        }

        CaseSpec build() {
            return new CaseSpec(number, caption, circumscription, responsible, reserved,
                    List.copyOf(defendants), List.copyOf(hearings), List.copyOf(measures), List.copyOf(deadlines));
        }
    }
}
