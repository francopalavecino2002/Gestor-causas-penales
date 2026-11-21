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

    private DemoData() {}

    record DemoUser(String email, String displayName, Role role) {}
}
