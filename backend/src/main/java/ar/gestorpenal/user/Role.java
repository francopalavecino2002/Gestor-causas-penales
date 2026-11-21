package ar.gestorpenal.user;

/** What a member of a firm can do. Exposed to Spring Security as {@code ROLE_<name>}. */
public enum Role {
    /** Titular: runs the firm, manages users and settings. */
    OWNER,
    /** Abogado: works on cases and hearings. */
    LAWYER,
    /** Procurador: follows up files and court offices. */
    PARALEGAL,
    /** Administrativo: agenda and clerical work. */
    ADMIN_STAFF;

    public String authority() {
        return "ROLE_" + name();
    }
}
