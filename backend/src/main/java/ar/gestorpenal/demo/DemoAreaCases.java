package ar.gestorpenal.demo;

import ar.gestorpenal.demo.DemoData.DemoUser;
import java.time.LocalTime;
import java.util.List;

/**
 * The civil and laboral cases of the demo firm (T63): a handful beside the criminal story, to show that
 * the same firm works in several practice areas. Their parties are fictitious people and companies
 * (nobody has a document number), their deadlines are loaded by hand as judicial deadlines because those
 * areas ship no computed rules, and their hearings are at 17:30, after every criminal hearing, on days
 * other than today, so the agenda of today and the lawyers' clash of the criminal story stay as they were.
 */
final class DemoAreaCases {

    static final String CIVIL = "civil";
    static final String LABORAL = "laboral";

    private static final String CONFLUENCIA = "i-confluencia";
    private static final LocalTime EVENING = LocalTime.of(17, 30);

    private static final DemoUser LUCIA = DemoData.OWNER;
    private static final DemoUser MARTIN = DemoData.LAWYER;
    private static final DemoUser JULIAN = DemoData.SECOND_LAWYER;

    static final List<AreaCaseSpec> CASES = List.of(
            new AreaCaseSpec(
                    "DEMO-CIV-001", CIVIL,
                    "Ejemplo, Rosa c/ Transportes Ficticios S.A. s/ daños y perjuicios por accidente de tránsito (ficticio)",
                    "ordinario", "actor", "prueba", MARTIN,
                    List.of(party("actor", human("Rosa", "Ejemplo Prueba")),
                            party("demandado", legal("Transportes Ficticios S.A."))),
                    new AreaHearing(1, "preliminar", "Juzgado Civil 2 (ficticio)"),
                    List.of(new ManualDeadline(3, 4, "Contestar el traslado de la pericia mecánica. [validar]"),
                            new ManualDeadline(1, 11, "Ofrecer a los testigos del accidente."))),
            new AreaCaseSpec(
                    "DEMO-CIV-002", CIVIL,
                    "Inmobiliaria Muestra S.R.L. c/ Quiroga Muestra, Hugo s/ desalojo por falta de pago (ficticio)",
                    "sumarisimo", "actor", "contestacion", JULIAN,
                    List.of(party("actor", legal("Inmobiliaria Muestra S.R.L.")),
                            party("demandado", human("Hugo", "Quiroga Muestra"))),
                    new AreaHearing(3, "de-conciliacion-o-acuerdo", "Juzgado Civil 1 (ficticio)"),
                    List.of(new ManualDeadline(2, 6, "Vence el plazo para que conteste el demandado."))),
            new AreaCaseSpec(
                    "DEMO-CIV-003", CIVIL,
                    "Comercial Ejemplo S.A. c/ Peña Prueba, Darío s/ cobro de pesos (ficticio)",
                    "ejecutivo", "demandado", "contestacion", LUCIA,
                    List.of(party("actor", legal("Comercial Ejemplo S.A.")),
                            party("demandado", human("Darío", "Peña Prueba"))),
                    new AreaHearing(6, "de-prueba", "Juzgado Civil 3 (ficticio)"),
                    List.of(new ManualDeadline(4, 2, "Oponer excepciones: vence el plazo de la citación de remate. [validar]"))),
            new AreaCaseSpec(
                    "DEMO-LAB-001", LABORAL,
                    "Vidal Ficticio, Marcos c/ Servicios Patagónicos Ejemplo S.R.L. s/ despido sin causa (ficticio)",
                    "ordinario", "actor", "conciliacion", MARTIN,
                    List.of(party("actor", human("Marcos", "Vidal Ficticio")),
                            party("demandado", legal("Servicios Patagónicos Ejemplo S.R.L."))),
                    new AreaHearing(2, "de-conciliacion", "Juzgado Laboral 1 (ficticio)"),
                    List.of(new ManualDeadline(1, 5, "Presentar el cálculo de la liquidación final y de la indemnización."))),
            new AreaCaseSpec(
                    "DEMO-LAB-002", LABORAL,
                    "Arce Prueba, Nélida c/ Obras del Sur Ficticia S.A. y ART Muestra S.A. s/ accidente de trabajo (ficticio)",
                    "sumarisimo", "actor", "prueba", JULIAN,
                    List.of(party("actor", human("Nélida", "Arce Prueba")),
                            party("demandado", legal("Obras del Sur Ficticia S.A.")),
                            party("aseguradora", legal("ART Muestra S.A."))),
                    new AreaHearing(5, "de-prueba", "Juzgado Laboral 2 (ficticio)"),
                    List.of(new ManualDeadline(3, 3, "Contestar la impugnación del dictamen médico. [validar]"),
                            new ManualDeadline(0, 12, "Acreditar la incapacidad con la historia clínica."))));

    private DemoAreaCases() {}

    private static PartySpec party(String role, PartyName name) {
        return new PartySpec(role, name);
    }

    private static PartyName human(String firstNames, String lastNames) {
        return new PartyName(firstNames, lastNames, null);
    }

    private static PartyName legal(String legalName) {
        return new PartyName(null, null, legalName);
    }

    /**
     * A case of an area without defendants. The client is the side in {@code represents}; the hearing
     * is the lawyer's, {@code weekday} weekdays from today at {@link #EVENING}.
     */
    record AreaCaseSpec(
            String number,
            String area,
            String caption,
            String actionType,
            String represents,
            String stage,
            DemoUser responsible,
            List<PartySpec> parties,
            AreaHearing hearing,
            List<ManualDeadline> deadlines) {

        String circumscription() {
            return CONFLUENCIA;
        }
    }

    /** A person (first and last names) or a company (legal name) with a role of the area's party-roles catalog. */
    record PartySpec(String role, PartyName name) {}

    record PartyName(String firstNames, String lastNames, String legalName) {

        boolean isLegalEntity() {
            return legalName != null;
        }
    }

    record AreaHearing(int weekday, String type, String room) {

        LocalTime time() {
            return EVENING;
        }

        int minutes() {
            return 60;
        }
    }

    /** A judicial deadline that started {@code triggeredDaysAgo} and falls due {@code dueInDays} from today. */
    record ManualDeadline(int triggeredDaysAgo, int dueInDays, String notes) {}
}
