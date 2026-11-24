package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.PracticeModule;
import java.util.List;
import java.util.Map;

/**
 * What the cases of one practice area are shown with: its modules, the names of the catalog items a
 * case stores as codes, and the circumscriptions shared by every area.
 */
record CaseVocabulary(
        List<PracticeModule> modules,
        Map<String, String> circumscriptions,
        List<String> stageOrder,
        Map<String, String> stages,
        Map<String, String> outcomes,
        Map<String, String> actionArticles) {

    String circumscriptionName(String code) {
        return nameOf(circumscriptions, code);
    }

    String stageName(String code) {
        return nameOf(stages, code);
    }

    String outcomeName(String code) {
        return nameOf(outcomes, code);
    }

    /** The article of the action type in the area's catalog, or {@code null} when the item has none. */
    String actionArticle(String actionTypeCode) {
        return actionArticles.get(actionTypeCode);
    }

    /** The catalog name, or the code itself when the catalog no longer lists it. */
    static String nameOf(Map<String, String> names, String code) {
        return code == null ? null : names.getOrDefault(code, code);
    }
}
