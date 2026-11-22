package ar.gestorpenal.casefile;

import ar.gestorpenal.jurisdiction.Catalog;
import ar.gestorpenal.person.PersonSummary;
import ar.gestorpenal.person.Persons;
import ar.gestorpenal.user.AppUser;
import ar.gestorpenal.user.UserRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    CaseViews(
            CaseTeamMemberRepository team,
            CasePartyRepository parties,
            DefendantRepository defendants,
            DefendantChargeRepository charges,
            CaseCatalogs catalogs,
            Persons persons,
            UserRepository users) {
        this.team = team;
        this.parties = parties;
        this.defendants = defendants;
        this.charges = charges;
        this.catalogs = catalogs;
        this.persons = persons;
        this.users = users;
    }

    /** The case heads for a list, with one query for all the defendants. */
    List<CaseView> heads(List<CaseFile> cases) {
        if (cases.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<Defendant>> defendantsByCase = defendants
                .findByCaseIdInAndArchivedAtIsNull(cases.stream().map(CaseFile::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(Defendant::getCaseId));
        Map<String, String> circumscriptions = catalogs.names(Catalog.CIRCUMSCRIPTIONS);
        List<String> stageOrder = catalogs.stageOrder();
        return cases.stream()
                .map(caseFile -> CaseView.of(
                        caseFile,
                        nameOf(circumscriptions, caseFile.getCircumscriptionCode()),
                        CaseSummary.of(defendantsByCase.getOrDefault(caseFile.getId(), List.of()), stageOrder)))
                .toList();
    }

    CaseDetail detail(CaseFile caseFile) {
        List<Defendant> activeDefendants =
                defendants.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseFile.getId());
        CaseView head = CaseView.of(
                caseFile,
                nameOf(catalogs.names(Catalog.CIRCUMSCRIPTIONS), caseFile.getCircumscriptionCode()),
                CaseSummary.of(activeDefendants, catalogs.stageOrder()));
        return CaseDetail.of(head, teamOf(caseFile.getId()), partiesOf(caseFile.getId()), defendantViews(activeDefendants));
    }

    DefendantView defendant(Defendant defendant) {
        return defendantViews(List.of(defendant)).get(0);
    }

    PartyView party(CaseParty party) {
        return partyViews(List.of(party)).get(0);
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

    private List<PartyView> partiesOf(UUID caseId) {
        return partyViews(parties.findByCaseIdAndArchivedAtIsNullOrderByCreatedAtAscIdAsc(caseId));
    }

    private List<PartyView> partyViews(List<CaseParty> rows) {
        Map<UUID, PersonSummary> people = persons.findAll(personIds(rows.stream().map(CaseParty::getPersonId)));
        Map<String, String> roles = catalogs.names(Catalog.PARTY_ROLES);
        return rows.stream()
                .map(party -> {
                    PersonSummary person = people.get(party.getPersonId());
                    return new PartyView(
                            party.getId(),
                            party.getPersonId(),
                            person.displayName(),
                            person.archived(),
                            party.getRoleCode(),
                            nameOf(roles, party.getRoleCode()));
                })
                .toList();
    }

    private List<DefendantView> defendantViews(List<Defendant> rows) {
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
        Map<String, String> stages = catalogs.names(Catalog.STAGES);
        Map<String, String> outcomes = catalogs.names(Catalog.CLOSING_OUTCOMES);
        return rows.stream()
                .map(defendant -> {
                    PersonSummary person = people.get(defendant.getPersonId());
                    return new DefendantView(
                            defendant.getId(),
                            defendant.getPersonId(),
                            person.displayName(),
                            person.archived(),
                            defendant.getStageCode(),
                            nameOf(stages, defendant.getStageCode()),
                            defendant.getStatus(),
                            defendant.getClosingOutcomeCode(),
                            nameOf(outcomes, defendant.getClosingOutcomeCode()),
                            defendant.getChargesFormulatedOn(),
                            defendant.isDefendedByFirm(),
                            defendant.getDefenceCounselKind(),
                            defendant.getDefenceCounselName(),
                            defendant.getRebellionDeclaredOn(),
                            defendant.getRebellionLiftedOn(),
                            defendant.getIndigenousPeople(),
                            defendant.getCreatedAt(),
                            chargesByDefendant.getOrDefault(defendant.getId(), List.of()));
                })
                .toList();
    }

    private static Collection<UUID> personIds(Stream<UUID> ids) {
        return ids.distinct().toList();
    }

    /** The catalog name, or the code itself when the catalog no longer lists it. */
    private static String nameOf(Map<String, String> names, String code) {
        return code == null ? null : names.getOrDefault(code, code);
    }
}
