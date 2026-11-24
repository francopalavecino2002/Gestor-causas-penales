package ar.gestorpenal.jurisdiction;

/** A feature of a practice area was used on a case of an area that does not declare its module. */
public class ModuleNotEnabledException extends RuntimeException {

    ModuleNotEnabledException(PracticeModule module, String areaCode) {
        super("The module '" + module.id() + "' is not enabled for this practice area ('" + areaCode + "')");
    }
}
