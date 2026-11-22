package ar.gestorpenal.demo;

import ar.gestorpenal.user.Role;
import java.util.List;

/** The fictitious firm and team of the demo profile. Emails use the reserved example.com domain. */
final class DemoData {

    static final String FIRM_NAME = "Estudio Demo (ficticio)";
    static final String FIRM_SLUG = "estudio-demo";

    static final List<DemoUser> USERS = List.of(
            new DemoUser("lucia.ejemplo@example.com", "Lucía Ejemplo", Role.OWNER),
            new DemoUser("martin.prueba@example.com", "Martín Prueba", Role.LAWYER),
            new DemoUser("sofia.ficticia@example.com", "Sofía Ficticia", Role.PARALEGAL));

    /** The lawyer who is the responsible of the demo cases. */
    static final DemoUser LAWYER = USERS.get(1);

    /** Fictitious people, without document numbers. */
    static final DemoPerson TOMAS = new DemoPerson("Tomás", "Fernández Ruiz");
    static final DemoPerson GABRIELA = new DemoPerson("Gabriela", "Soto Ejemplo");
    static final DemoPerson NICOLAS = new DemoPerson("Nicolás", "Paz Ficticio");

    static final String OPEN_CASE_NUMBER = "DEMO-001";
    static final String RESERVED_CASE_NUMBER = "DEMO-002";

    private DemoData() {}

    record DemoUser(String email, String displayName, Role role) {}

    record DemoPerson(String firstNames, String lastNames) {}
}
