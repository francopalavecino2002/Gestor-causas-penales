import type { AgendaItem } from "../src/features/agenda/agenda-types";
import type { CaseData, DefendantData, PartyData } from "../src/features/cases/case-write-api";
import type { CaseDetail, CaseView, DefendantView } from "../src/features/cases/case-types";
import type { HearingData, HearingDetail } from "../src/features/hearings/hearing-api";
import type { NewHumanPerson, PersonView } from "../src/features/persons/person-api";
import { areaCatalog, CIVIL_AREA, DETAIL_CIVIL, PENAL_AREA } from "../src/test/area-fixtures";
import { CATALOGS, DETAILS, HEARINGS_BY_CASE } from "../src/test/case-fixtures";
import { FORM_CATALOGS, MEMBERS, PERSONS } from "../src/test/form-fixtures";

type Answer = { status: number; json?: unknown } | undefined;

/** The criminal catalogs the fixtures serve. */
export const CRIMINAL_CATALOGS = [...Object.values(CATALOGS), ...FORM_CATALOGS];

const catalogItem = (catalog: string, code: string | null, area: string) =>
  code
    ? areaCatalog(catalog, area, CRIMINAL_CATALOGS)?.items.find((item) => item.code === code)
    : undefined;
const catalogName = (catalog: string, code: string | null, area = "penal"): string | null =>
  code ? (catalogItem(catalog, code, area)?.name ?? code) : null;
const catalogArticle = (catalog: string, code: string, area = "penal"): string | null =>
  catalogItem(catalog, code, area)?.article ?? null;

const memberName = (id: string) => MEMBERS.find((member) => member.id === id)?.displayName ?? id;

/**
 * The create and edit endpoints of T35 (cases, defendants, persons, hearings, firm members),
 * stateful so what a test saves shows up in the next GET: the case list, its detail and the
 * agenda. Undefined when the request is not one of them.
 */
export function formsBackend() {
  const cases: CaseDetail[] = [];
  const persons: PersonView[] = structuredClone(PERSONS);
  const hearings: HearingDetail[] = [];
  let next = 500;
  const newId = (group: string) =>
    `00000000-0000-4000-${group}-${String(next++).padStart(12, "0")}`;

  const view = (data: CaseData, id: string, previous?: CaseDetail): CaseDetail => {
    const area = previous?.practiceArea ?? data.practiceArea ?? "penal";
    const modules = area === "penal" ? PENAL_AREA.modules : CIVIL_AREA.modules;
    const ownCourse = !modules.includes("defendants");
    const stageCode = ownCourse ? (data.stageCode ?? "inicio") : null;
    return {
      id,
      practiceArea: area,
      modules,
      caption: data.caption,
      internalNumber: data.internalNumber,
      mpfLegajo: data.mpfLegajo?.toUpperCase() ?? null,
      ofijuNumber: data.ofijuNumber,
      pehuenNumber: data.pehuenNumber,
      circumscriptionCode: data.circumscriptionCode,
      circumscriptionName: catalogName("circumscriptions", data.circumscriptionCode) ?? "",
      actionType: data.actionType,
      actionArticle: catalogArticle("action-types", data.actionType, area),
      represents: data.represents,
      stageCode,
      stageName: catalogName("stages", stageCode, area),
      status: ownCourse ? (data.status ?? "ACTIVE") : null,
      closingOutcomeCode: ownCourse ? (data.closingOutcomeCode ?? null) : null,
      closingOutcomeName: ownCourse
        ? catalogName("closing-outcomes", data.closingOutcomeCode ?? null, area)
        : null,
      reserved: data.reserved,
      archived: false,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      summary: {
        ...(previous?.summary ?? {
          defendantCount: 0,
          openDefendantCount: 0,
          mostDelayedStage: null,
          detaineeCount: 0,
          nextHearing: null,
        }),
        ...(ownCourse ? { mostDelayedStage: stageCode } : {}),
      },
      customFields: {},
      team: previous?.team ?? [
        {
          userId: data.responsibleUserId ?? MEMBERS[1]!.id,
          displayName: memberName(data.responsibleUserId ?? MEMBERS[1]!.id),
          role: "RESPONSIBLE",
        },
      ],
      parties: previous?.parties ?? [],
      defendants: previous?.defendants ?? [],
    };
  };

  const hearingOf = (caseFile: CaseDetail, data: HearingData, id: string): HearingDetail => ({
    id,
    caseId: caseFile.id,
    caseCaption: caseFile.caption,
    practiceArea: caseFile.practiceArea,
    typeCode: data.typeCode,
    typeName: catalogName("hearing-types", data.typeCode, caseFile.practiceArea) ?? data.typeCode,
    typeArticle: catalogArticle("hearing-types", data.typeCode, caseFile.practiceArea),
    startsAt: new Date(data.startsAt).toISOString(),
    durationMinutes: data.durationMinutes,
    room: data.room,
    judge: data.judge,
    ofijuReference: data.ofijuReference,
    requestedBy: data.requestedBy,
    statusCode: data.statusCode,
    statusName:
      catalogName("hearing-statuses", data.statusCode, caseFile.practiceArea) ?? data.statusCode,
    cancellationReasonCode: data.cancellationReasonCode,
    cancellationReasonName: catalogName(
      "cancellation-reasons",
      data.cancellationReasonCode,
      caseFile.practiceArea,
    ),
    heldAsTypeCode: null,
    heldAsTypeName: null,
    resultSummary: data.resultSummary,
    nextHearingId: null,
    notes: data.notes,
    archived: false,
    createdAt: new Date().toISOString(),
    defendants: data.defendantIds.map((defendantId) => ({
      id: defendantId,
      name:
        caseFile.defendants.find((defendant) => defendant.id === defendantId)?.displayName ??
        defendantId,
    })),
    lawyers: data.lawyerIds.map((userId) => ({ id: userId, name: memberName(userId) })),
    clashes: [],
  });

  const findCase = (id: string) =>
    cases.find((candidate) => candidate.id === id) ??
    [...DETAILS, DETAIL_CIVIL].find((detail) => detail.id === id);

  const answer = (method: string, url: URL, body: () => unknown): Answer => {
    const path = url.pathname;
    if (method === "GET" && path === "/api/v1/users") return { status: 200, json: MEMBERS };
    const catalog = /^\/api\/v1\/catalogs\/([a-z-]+)$/.exec(path)?.[1];
    if (method === "GET" && catalog) {
      const found = areaCatalog(catalog, url.searchParams.get("area"), CRIMINAL_CATALOGS);
      if (found) return { status: 200, json: found };
    }

    if (method === "GET" && path === "/api/v1/persons") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const items = persons.filter(
        (person) =>
          person.displayName.toLowerCase().includes(q) || (person.documentNumber ?? "").includes(q),
      );
      return { status: 200, json: { items, page: 0, size: 8, total: items.length } };
    }
    if (method === "POST" && path === "/api/v1/persons") {
      const data = body() as NewHumanPerson;
      const person: PersonView = {
        id: newId("8000"),
        kind: "HUMAN",
        displayName: data.firstNames ? `${data.lastNames}, ${data.firstNames}` : data.lastNames,
        firstNames: data.firstNames,
        lastNames: data.lastNames,
        legalName: null,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        archived: false,
      };
      persons.push(person);
      return { status: 201, json: person };
    }

    if (method === "POST" && path === "/api/v1/cases") {
      const created = view(body() as CaseData, newId("a000"));
      cases.unshift(created);
      return { status: 201, json: created };
    }
    const caseId = /^\/api\/v1\/cases\/([^/]+)$/.exec(path)?.[1];
    const own = caseId ? cases.find((candidate) => candidate.id === caseId) : undefined;
    if (own && method === "GET") return { status: 200, json: own };
    if (own && method === "PUT") {
      Object.assign(own, view(body() as CaseData, own.id, own));
      return { status: 200, json: own };
    }
    const sub = /^\/api\/v1\/cases\/([^/]+)\/(hearings|deadlines|defendants|parties)$/.exec(path);
    const subCase = sub ? cases.find((candidate) => candidate.id === sub[1]) : undefined;
    if (sub && method === "GET" && subCase) {
      return {
        status: 200,
        json:
          sub[2] === "hearings"
            ? hearings.filter((hearing) => hearing.caseId === subCase.id).reverse()
            : [],
      };
    }
    if (sub?.[2] === "parties" && method === "POST" && subCase) {
      const data = body() as PartyData;
      const party = {
        id: newId("d000"),
        personId: data.personId,
        displayName:
          persons.find((candidate) => candidate.id === data.personId)?.displayName ?? data.personId,
        personArchived: false,
        roleCode: data.roleCode,
        roleName: catalogName("party-roles", data.roleCode, subCase.practiceArea) ?? data.roleCode,
      };
      subCase.parties.push(party);
      return { status: 201, json: party };
    }
    if (sub?.[2] === "defendants" && method === "POST" && subCase) {
      const data = body() as DefendantData & { personId: string };
      const person = persons.find((candidate) => candidate.id === data.personId);
      const defendant: DefendantView = {
        id: newId("c000"),
        personId: data.personId,
        displayName: person?.displayName ?? data.personId,
        personArchived: false,
        stageCode: data.stageCode,
        stageName: catalogName("stages", data.stageCode) ?? data.stageCode,
        status: data.status,
        closingOutcomeCode: data.closingOutcomeCode,
        closingOutcomeName: catalogName("closing-outcomes", data.closingOutcomeCode),
        chargesFormulatedOn: data.chargesFormulatedOn,
        defendedByFirm: data.defendedByFirm,
        defenceCounselKind: data.defenceCounselKind,
        defenceCounselName: data.defenceCounselName,
        rebellionDeclaredOn: null,
        rebellionLiftedOn: null,
        indigenousPeople: null,
        createdAt: new Date().toISOString(),
        charges: [],
        customFields: {},
      };
      subCase.defendants.push(defendant);
      subCase.summary = {
        ...subCase.summary,
        defendantCount: subCase.defendants.length,
        openDefendantCount: subCase.defendants.length,
        mostDelayedStage: data.stageCode,
      };
      return { status: 201, json: defendant };
    }
    const hearingCase =
      sub?.[2] === "hearings" && method === "POST" ? findCase(sub[1]!) : undefined;
    if (hearingCase) {
      const created = hearingOf(hearingCase, body() as HearingData, newId("9000"));
      hearings.push(created);
      return { status: 201, json: created };
    }
    const hearingId = /^\/api\/v1\/hearings\/([^/]+)$/.exec(path)?.[1];
    const fixture = Object.values(HEARINGS_BY_CASE)
      .flat()
      .find((candidate) => candidate.id === hearingId);
    if (fixture && !hearings.some((candidate) => candidate.id === fixture.id)) {
      // A fixture hearing becomes editable state the first time it is read.
      hearings.push({ ...fixture, requestedBy: null, clashes: [] });
    }
    const hearing = hearingId
      ? hearings.find((candidate) => candidate.id === hearingId)
      : undefined;
    if (hearing && method === "GET") return { status: 200, json: hearing };
    if (hearing && method === "PUT") {
      const caseFile = findCase(hearing.caseId);
      if (caseFile) Object.assign(hearing, hearingOf(caseFile, body() as HearingData, hearing.id));
      return { status: 200, json: hearing };
    }
    return undefined;
  };

  /** The saved hearings as the agenda lists them. */
  const agendaItems = (): AgendaItem[] =>
    hearings.map((hearing) => ({
      hearingId: hearing.id,
      caseId: hearing.caseId,
      caseCaption: hearing.caseCaption,
      practiceArea: hearing.practiceArea,
      typeCode: hearing.typeCode,
      typeName: hearing.typeName,
      typeArticle: hearing.typeArticle,
      statusCode: hearing.statusCode,
      statusName: hearing.statusName,
      startsAt: hearing.startsAt,
      durationMinutes: hearing.durationMinutes,
      room: hearing.room,
      judge: hearing.judge,
      defendants: hearing.defendants,
      lawyers: hearing.lawyers,
      detainee: false,
      hasClash: false,
    }));

  /** The saved cases, first in the list as the newest. */
  const caseViews = (): CaseView[] => cases;

  return { answer, agendaItems, caseViews };
}
