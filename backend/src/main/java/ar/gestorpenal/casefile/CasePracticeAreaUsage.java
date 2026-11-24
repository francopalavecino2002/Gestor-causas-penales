package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.PracticeAreaUsage;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The firm's cases, as the practice area settings ask about them (tenant-scoped like every query). */
@Component
class CasePracticeAreaUsage implements PracticeAreaUsage {

    private final CaseFileRepository cases;

    CasePracticeAreaUsage(CaseFileRepository cases) {
        this.cases = cases;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasActiveCases(String areaCode) {
        return cases.existsByPracticeAreaAndArchivedAtIsNull(areaCode);
    }
}
