package ar.gestorpenal.casefile;

/** How the criminal action is exercised, with the article of the CPP de Neuquén that defines it. */
enum ActionType {
    /** Acción pública. */
    PUBLIC("99"),
    /** Dependiente de instancia privada. */
    PUBLIC_ON_COMPLAINT("100"),
    /** Acción privada. */
    PRIVATE("101");

    private final String article;

    ActionType(String article) {
        this.article = article;
    }

    String article() {
        return article;
    }
}
