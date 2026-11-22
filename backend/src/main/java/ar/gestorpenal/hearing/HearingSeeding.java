package ar.gestorpenal.hearing;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The narrow public entry point the demo data uses to create hearings and coercive measures without a
 * logged-in user. It trusts its caller: the codes are those of the jurisdiction package and nobody is
 * checked for access. Call it inside a tenant scope, outside any transaction.
 */
@Service
public class HearingSeeding {

    private final HearingRepository hearings;
    private final HearingDefendantRepository hearingDefendants;
    private final HearingLawyerRepository hearingLawyers;
    private final CoerciveMeasureRepository measures;
    private final CoerciveMeasureRiskRepository risks;
    private final HearingCalendar calendar;

    HearingSeeding(
            HearingRepository hearings,
            HearingDefendantRepository hearingDefendants,
            HearingLawyerRepository hearingLawyers,
            CoerciveMeasureRepository measures,
            CoerciveMeasureRiskRepository risks,
            HearingCalendar calendar) {
        this.hearings = hearings;
        this.hearingDefendants = hearingDefendants;
        this.hearingLawyers = hearingLawyers;
        this.measures = measures;
        this.risks = risks;
        this.calendar = calendar;
    }

    /** Today in the firm's zone. */
    public LocalDate today() {
        return calendar.today();
    }

    /** The instant of {@code time} on {@code day} in the firm's zone. */
    public Instant at(LocalDate day, LocalTime time) {
        return calendar.startOfDay(day).plusSeconds(time.toSecondOfDay());
    }

    @Transactional(readOnly = true)
    public boolean hasHearings(UUID caseId) {
        return !hearings.findByCaseIdOrderByStartsAtDescIdAsc(caseId).isEmpty();
    }

    @Transactional(readOnly = true)
    public boolean hasMeasures(UUID defendantId) {
        return !measures.findByDefendantIdOrderByStartsOnDescIdAsc(defendantId).isEmpty();
    }

    /** A scheduled hearing attended by {@code lawyerIds} and about {@code defendantIds}. */
    @Transactional
    public UUID createHearing(
            UUID caseId,
            String typeCode,
            Instant startsAt,
            int durationMinutes,
            String room,
            List<UUID> defendantIds,
            List<UUID> lawyerIds) {
        Hearing hearing = hearings.saveAndFlush(Hearing.create(
                caseId,
                new HearingData(
                        typeCode, startsAt, durationMinutes, room,
                        null, null, null, null, null, null, null, null, null, null)));
        defendantIds.forEach(id -> hearingDefendants.save(HearingDefendant.create(hearing.getId(), id)));
        lawyerIds.forEach(id -> hearingLawyers.save(HearingLawyer.create(hearing.getId(), id)));
        return hearing.getId();
    }

    /** A coercive measure with its procedural risks. */
    @Transactional
    public UUID createMeasure(
            UUID defendantId,
            String measureCode,
            String detentionPlace,
            List<String> riskCodes,
            LocalDate startsOn,
            LocalDate endsOn,
            LocalDate nextReviewOn) {
        CoerciveMeasure measure = measures.saveAndFlush(CoerciveMeasure.create(
                defendantId,
                new CoerciveMeasureData(
                        measureCode, null, detentionPlace, riskCodes, startsOn, endsOn, nextReviewOn, null)));
        riskCodes.forEach(code -> risks.save(CoerciveMeasureRisk.create(measure.getId(), code)));
        return measure.getId();
    }
}
