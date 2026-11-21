package ar.gestorpenal.jurisdiction;

import java.util.List;

/** A jurisdiction package that cannot be read or breaks a rule; the application refuses to start. */
public class InvalidJurisdictionPackageException extends RuntimeException {

    private final List<String> problems;

    InvalidJurisdictionPackageException(String location, List<String> problems) {
        super("Invalid jurisdiction package " + location + ":\n - " + String.join("\n - ", problems));
        this.problems = List.copyOf(problems);
    }

    InvalidJurisdictionPackageException(String location, String problem, Throwable cause) {
        super("Invalid jurisdiction package " + location + ": " + problem, cause);
        this.problems = List.of(problem);
    }

    public List<String> problems() {
        return problems;
    }
}
