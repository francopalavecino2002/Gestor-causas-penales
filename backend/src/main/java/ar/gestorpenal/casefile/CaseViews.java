package ar.gestorpenal.casefile;

import ar.gestorpenal.customfield.CustomFieldEntity;
import ar.gestorpenal.customfield.CustomFields;
import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.jurisdiction.PracticeAreas;
import ar.gestorpenal.person.PersonSummary;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

/**
 * Builds what the API shows from the entities. It runs inside the caller's transaction, so the
 * repositories only see the current firm's rows.
 */
@Component
class CaseViews {

    private final CaseTeamMemberRepository team;
    private final CasePartyRepository parties;
    private final DefendantRepository defendants;
    private final DefendantChargeRepository charges;
    private final CaseCatalogs catalogs;
    private final Persons persons;
    private final UserRepository users;
    private final CaseHearingSummaries hearingSummaries;
    private final CustomFields customFields;
    private final PracticeAreas areas;

    CaseViews(
            CaseTeamMemberRepository team,
            CasePartyRepository parties,
            DefendantRepository defendants,
            DefendantChargeRepository charges,
            CaseCatalogs catalogs,
            Persons persons,
            UserRepository users,
            CaseHearingSummaries hearingSummaries,
            CustomFields customFields,
            PracticeAreas areas) {
        this.team = team;
        this.parties = parties;
        this.defendants = defendants;
        this.charges = charges;
        this.catalogs = catalogs;
        this.persons = persons;
        this.users = users;
        this.hearingSummaries = hearingSummaries;
        this.customFields = customFields;
        this.areas = areas;
    }

    /** The case heads for a list, with one query for all the defendants, detainees and next hearings. */
    List<CaseView> heads(List<CaseFile> cases) {
        if (cases.isEmpty()) {
            return List.of();
        }
        List<UUID> caseIds = cases.stream().map(CaseFile::getId).toList();
        Map<UUID, List<Defendant>> defendantsByCase = defendants
                .findByCaseIdInAndArchivedAtIsNull(caseIds)
                .stream()
                .collect(Collectors.groupingBy(Defendant::getCaseId));
        Map<UUID, Integer> detainees = hearingSummaries.detaineeCounts(caseIds);
        Map<UUID, NextHearing> nextHearings = hearingSummaries.nextHearings(caseIds);
        Map<String, CaseVocabulary> vocabularies = new HashMap<>();
        return cases.stream()
                .map(caseFile -> {
                    CaseVocabulary vocabulary = vocabularies.computeIfAbsent(caseFile.getPracticeArea(), this::vocabularyOf);
                    return CaseView.of(
                            caseFile,
                            vocabulary,
                            summary(
                                    caseFile,
                                    defendantsByCase.getOrDefault(caseFile.getId(), List.of()),
                                    vocabulary.stageOrder(),
                                    detainees,
                                    nextHearings));
                })
                .toList();
    }

    private CaseVocabulary vocabularyOf(String area) {
        return new CaseVocabulary(
                areas.get(area).modules(),
                catalogs.names(area, Catalog.CIRCUMSCRIPTIONS),
                catalogs.stageOrder(area),
                catalogs.names(area, Catalog.STAGES),
                catalogs.names(area, Catalog.CLOSING_OUTCOMES),
                catalogs.articles(area, Catalog.ACTION_TYPES));
    }

    CaseDetail detail(CaseFile caseFile) {
        List<Defendant> activeDefendants =
                defendants.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseFile.getId());
        List<UUID> caseIds = List.of(caseFile.getId());
        String area = caseFile.getPracticeArea();
        CaseVocabulary vocabulary = vocabularyOf(area);
        CaseSummary summary = summary(
                caseFile,
                activeDefendants,
                vocabulary.stageOrder(),
                hearingSummaries.detaineeCounts(caseIds),
                hearingSummaries.nextHearings(caseIds));
        CaseView head = CaseView.of(caseFile, vocabulary, summary);
        return CaseDetail.of(
                head,
                customFields.visibility(CustomFieldEntity.CASE_FILE).apply(caseFile.getCustomFields()),
                teamOf(caseFile.getId()),
                partiesOf(caseFile.getId(), area),
                defendantViews(area, activeDefendants));
    }

    /**
     * The summary of a case, enriched with its detainee count and next hearing: from its defendants, or
     * from the case's own stage when its area has no defendants.
     */
    private static CaseSummary summary(
            CaseFile caseFile,
            List<Defendant> caseDefendants,
            List<String> stageOrder,
            Map<UUID, Integer> detainees,
            Map<UUID, NextHearing> nextHearings) {
        UUID caseId = caseFile.getId();
        CaseSummary base = caseFile.getStageCode() == null
                ? CaseSummary.of(caseDefendants, stageOrder)
                : CaseSummary.ofCase(caseFile.getStageCode());
        return base.withHearingData(detainees.getOrDefault(caseId, 0), nextHearings.get(caseId));
    }

    DefendantView defendant(String area, Defendant defendant) {
        return defendantViews(area, List.of(defendant)).get(0);
    }

    PartyView party(String area, CaseParty party) {
        return partyViews(area, List.of(party)).get(0);
    }

    private List<TeamMemberView> teamOf(UUID caseId) {
        List<CaseTeamMember> members = team.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId);
        Map<UUID, String> names = users.findAllById(members.stream().map(CaseTeamMember::getUserId).toList())
                .stream()
                .collect(Collectors.toMap(AppUser::getId, AppUser::getDisplayName));
        return members.stream()
                .map(member -> new TeamMemberView(member.getUserId(), names.get(member.getUserId()), member.getTeamRole()))
                .toList();
    }

    private List<PartyView> partiesOf(UUID caseId, String area) {
        return partyViews(area, parties.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId));
    }

    private List<PartyView> partyViews(String area, List<CaseParty> rows) {
        Map<UUID, PersonSummary> people = persons.findAll(personIds(rows.stream().map(CaseParty::getPersonId)));
        Map<String, String> roles = catalogs.names(area, Catalog.PARTY_ROLES);
        return rows.stream()
                .map(party -> {
                    PersonSummary person = people.get(party.getPersonId());
                    return new PartyView(
                            party.getId(),
                            party.getPersonId(),
                            person.displayName(),
                            person.archived(),
                            party.getRoleCode(),
                            CaseVocabulary.nameOf(roles, party.getRoleCode()));
                })
                .toList();
    }

    private List<DefendantView> defendantViews(String area, List<Defendant> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, PersonSummary> people = persons.findAll(personIds(rows.stream().map(Defendant::getPersonId)));
        Map<UUID, List<ChargeView>> chargesByDefendant = charges
                .findByDefendantIdInAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(
                        rows.stream().map(Defendant::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(
                        DefendantCharge::getDefendantId,
                        Collectors.mapping(ChargeView::of, Collectors.toList())));
        Map<String, String> stages = catalogs.names(area, Catalog.STAGES);
        Map<String, String> outcomes = catalogs.names(area, Catalog.CLOSING_OUTCOMES);
        UnaryOperator<Map<String, Object>> visibleFields = customFields.visibility(CustomFieldEntity.DEFENDANT);
        return rows.stream()
                .map(defendant -> {
                    PersonSummary person = people.get(defendant.getPersonId());
                    return new DefendantView(
                            defendant.getId(),
                            defendant.getPersonId(),
                            person.displayName(),
                            person.archived(),
                            defendant.getStageCode(),
                            CaseVocabulary.nameOf(stages, defendant.getStageCode()),
                            defendant.getStatus(),
                            defendant.getClosingOutcomeCode(),
                            CaseVocabulary.nameOf(outcomes, defendant.getClosingOutcomeCode()),
                            defendant.getChargesFormulatedOn(),
                            defendant.isDefendedByFirm(),
                            defendant.getDefenceCounselKind(),
                            defendant.getDefenceCounselName(),
                            defendant.getRebellionDeclaredOn(),
                            defendant.getRebellionLiftedOn(),
                            defendant.getIndigenousPeople(),
                            defendant.getCreatedAt(),
                            chargesByDefendant.getOrDefault(defendant.getId(), List.of()),
                            visibleFields.apply(defendant.getCustomFields()));
                })
                .toList();
    }

    private static Collection<UUID> personIds(Stream<UUID> ids) {
        return ids.distinct().toList();
    }
}
