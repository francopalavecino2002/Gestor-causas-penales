/*
 * Fictitious news wall of the demo firm around FIXTURE_NOW (Monday 23 November 2026, 10:20 in
 * Neuquén), shared by the Vitest suite and the Playwright mock backend, plus a small stateful
 * stand-in for `/api/v1/news`. Names, captions and posts are made up.
 * Relative imports only: the e2e project (tsconfig.node.json) has no "@/" alias.
 */
import type {
  DeadlineAlert,
  NewsActor,
  NewsCaseLink,
  NewsFeed,
  NewsHearingLink,
  NewsItem,
} from "../features/news/news-types";
import { LAWYER_HUGO, LAWYER_LUCIA, LAWYER_PAULA } from "./agenda-fixtures";
import { CASE_EJEMPLO, CASE_MODELO, CASE_MUESTRA } from "./case-fixtures";

const DISCLAIMER = "Cálculo asistido: verificá con la norma.";
const LAW = "CPP de Neuquén (Ley 2784)";

const actor = (ref: { id: string; name: string }): NewsActor => ({
  id: ref.id,
  displayName: ref.name,
});

const LUCIA = actor(LAWYER_LUCIA);
const PAULA = actor(LAWYER_PAULA);
const HUGO = actor(LAWYER_HUGO);

const caseLink = (ref: { id: string; caption: string }): NewsCaseLink => ({
  id: ref.id,
  caption: ref.caption,
  practiceArea: "penal",
});

const hearingId = (n: number) => `00000000-0000-4000-d100-${String(n).padStart(12, "0")}`;
const postId = (n: number) => `00000000-0000-4000-d200-${String(n).padStart(12, "0")}`;
const caseId = (n: number) => `00000000-0000-4000-d300-${String(n).padStart(12, "0")}`;

function hearing(n: number, overrides: Partial<NewsHearingLink>): NewsHearingLink {
  return {
    id: hearingId(n),
    typeCode: "audiencia",
    typeName: "Audiencia",
    startsAt: "2026-11-30T13:00:00Z",
    previousStartsAt: null,
    newStartsAt: null,
    statusCode: null,
    statusName: null,
    ...overrides,
  };
}

function item(id: number, overrides: Partial<NewsItem> & Pick<NewsItem, "kind">): NewsItem {
  return {
    id,
    occurredAt: "2026-11-23T12:00:00Z",
    actor: null,
    caseLink: null,
    hearing: null,
    post: null,
    ...overrides,
  };
}

/** Paula's notice to the firm this morning, on two lines. */
export const NEWS_POST_MEETING = item(120, {
  kind: "POST",
  occurredAt: "2026-11-23T13:05:00Z",
  actor: PAULA,
  post: {
    id: postId(1),
    body: "Mañana a las 8:30 nos juntamos para repartir las audiencias de diciembre.\nTraigan la agenda al día.",
    canArchive: true,
  },
});

/** Hugo loaded the result of this morning's review. */
export const NEWS_RESULT = item(119, {
  kind: "HEARING_RESULT",
  occurredAt: "2026-11-23T12:50:00Z",
  actor: HUGO,
  caseLink: caseLink(CASE_MODELO),
  hearing: hearing(1, {
    typeCode: "revision-de-prision-preventiva",
    typeName: "Revisión de prisión preventiva",
    startsAt: "2026-11-23T12:00:00Z",
    statusCode: "efectiva",
    statusName: "Efectiva",
  }),
});

/** Paula moved a hearing a week later. */
export const NEWS_RESCHEDULED = item(118, {
  kind: "HEARING_RESCHEDULED",
  occurredAt: "2026-11-23T12:10:00Z",
  actor: PAULA,
  caseLink: caseLink(CASE_EJEMPLO),
  hearing: hearing(2, {
    typeCode: "control-de-acusacion",
    typeName: "Control de acusación",
    startsAt: "2026-12-10T14:00:00Z",
    previousStartsAt: "2026-12-03T13:00:00Z",
    newStartsAt: "2026-12-10T14:00:00Z",
  }),
});

/** The user scheduled a hearing. */
export const NEWS_SCHEDULED = item(117, {
  kind: "HEARING_SCHEDULED",
  occurredAt: "2026-11-23T11:40:00Z",
  actor: LUCIA,
  caseLink: caseLink(CASE_MUESTRA),
  hearing: hearing(3, {
    typeCode: "formulacion-de-cargos",
    typeName: "Formulación de cargos",
    startsAt: "2026-11-30T13:00:00Z",
  }),
});

/** The user's own post, yesterday evening. */
export const NEWS_POST_TEMPLATE = item(116, {
  kind: "POST",
  occurredAt: "2026-11-22T21:30:00Z",
  actor: LUCIA,
  post: {
    id: postId(2),
    body: "Dejé en la carpeta compartida el modelo de escrito de oposición a la prisión preventiva (ficticio).",
    canArchive: true,
  },
});

const IMPORTED_CAPTIONS = [
  "Inventado, Sergio s/ amenazas",
  "Supuesto, Bruno s/ daño",
  "Imaginario, Ezequiel s/ lesiones leves",
  "Ficticio, Ramiro s/ hurto",
];

/** Paula's spreadsheet import on Thursday: four cases in the same minute. */
export const NEWS_IMPORTED: NewsItem[] = IMPORTED_CAPTIONS.map((caption, index) =>
  item(115 - index, {
    kind: "CASE_OPENED",
    occurredAt: `2026-11-19T15:00:0${3 - index}Z`,
    actor: PAULA,
    caseLink: caseLink({ id: caseId(index + 1), caption }),
  }),
);

/** Hugo opened a case on Wednesday. */
export const NEWS_OPENED = item(110, {
  kind: "CASE_OPENED",
  occurredAt: "2026-11-18T14:00:00Z",
  actor: HUGO,
  caseLink: caseLink(CASE_MODELO),
});

/** Seed data: no member did it. */
export const NEWS_SEEDED = item(100, {
  kind: "CASE_OPENED",
  occurredAt: "2026-11-02T12:00:00Z",
  caseLink: caseLink(CASE_EJEMPLO),
});

export const ALL_NEWS: NewsItem[] = [
  NEWS_POST_MEETING,
  NEWS_RESULT,
  NEWS_RESCHEDULED,
  NEWS_SCHEDULED,
  NEWS_POST_TEMPLATE,
  ...NEWS_IMPORTED,
  NEWS_OPENED,
  NEWS_SEEDED,
];

function alert(
  n: number,
  overrides: Partial<DeadlineAlert> & Pick<DeadlineAlert, "ruleName" | "source" | "dueOn">,
): DeadlineAlert {
  return {
    id: `00000000-0000-4000-d400-${String(n).padStart(12, "0")}`,
    caseId: CASE_MODELO.id,
    caseCaption: CASE_MODELO.caption,
    defendantName: null,
    detainee: false,
    dueAt: null,
    daysLeft: null,
    hoursLeft: null,
    disclaimer: DISCLAIMER,
    ...overrides,
  };
}

/** A day-based term ending Friday at 24 h. */
export const DUE_SOON_EVIDENCE = alert(1, {
  caseId: CASE_EJEMPLO.id,
  caseCaption: CASE_EJEMPLO.caption,
  ruleName: "Ofrecimiento de prueba",
  source: `Art. 168 · ${LAW} [validar]`,
  dueOn: "2026-11-27",
  dueAt: "2026-11-28T03:00:00Z",
  daysLeft: 4,
  hoursLeft: 89,
});

/** 24 h from a detention at 02:00 today: 15 hours left, a detained client. */
export const DUE_SOON_CONTROL = alert(2, {
  caseId: CASE_EJEMPLO.id,
  caseCaption: CASE_EJEMPLO.caption,
  defendantName: "Lucas Ejemplo",
  ruleName: "Detención sin control judicial",
  source: `Art. 112; 49 inc. 5 · ${LAW} [validar]`,
  detainee: true,
  dueOn: "2026-11-24",
  dueAt: "2026-11-24T05:00:00Z",
  daysLeft: 1,
  hoursLeft: 15,
});

/** As the backend sends them: soonest first (the screen puts detainee ones first). */
export const ALL_DUE_SOON: DeadlineAlert[] = [DUE_SOON_EVIDENCE, DUE_SOON_CONTROL];

/** `count` posts by Hugo, one per hour back from today 09:00: enough to need "Mirá más". */
export function manyPosts(count: number): NewsItem[] {
  return Array.from({ length: count }, (_, index) =>
    item(1000 - index, {
      kind: "POST",
      occurredAt: new Date(Date.parse("2026-11-23T12:00:00Z") - index * 3_600_000).toISOString(),
      actor: HUGO,
      post: {
        id: postId(100 + index),
        body: `Aviso ficticio número ${index + 1}.`,
        canArchive: false,
      },
    }),
  );
}

/** The query string of `GET /api/v1/news`, as plain strings. */
export type NewsQuery = Partial<Record<string, string | null>>;

/** What `GET /api/v1/news` answers, paged like the real one (size capped at 50). */
export function newsFeedFor(
  items: NewsItem[],
  dueSoon: DeadlineAlert[],
  query: NewsQuery,
): NewsFeed {
  const size = Math.min(Math.max(Number(query.size ?? 20), 1), 50);
  const page = Math.max(Number(query.page ?? 0), 0);
  return {
    dueSoon: page === 0 ? dueSoon : [],
    items: items.slice(page * size, page * size + size),
    page,
    size,
    total: items.length,
  };
}

/**
 * A stateful `/api/v1/news` over a copy of the fixtures: a new post shows up first in the next
 * GET, an archived one leaves it and a restored one comes back. Answers undefined when the request
 * is not one of its routes.
 */
export function newsBackend(
  initial: NewsItem[] = ALL_NEWS,
  dueSoon: DeadlineAlert[] = ALL_DUE_SOON,
  me: { id: string; name: string } = LAWYER_LUCIA,
) {
  const items: NewsItem[] = structuredClone(initial);
  const archived = new Set<string>();
  let next = 5000;

  return (
    method: string,
    path: string,
    query: NewsQuery,
    body: () => unknown,
  ): { status: number; json?: unknown } | undefined => {
    if (method === "GET" && path === "/api/v1/news") {
      const visible = items.filter((entry) => !entry.post || !archived.has(entry.post.id));
      return { status: 200, json: newsFeedFor(visible, dueSoon, query) };
    }
    if (method === "POST" && path === "/api/v1/news/posts") {
      const text = String((body() as { body?: unknown }).body ?? "");
      if (text.trim() === "" || text.length > 1000) return { status: 400 };
      const post = { id: postId(next), body: text, canArchive: true };
      items.unshift(
        item(next++, { kind: "POST", occurredAt: "2026-11-23T13:20:00Z", actor: actor(me), post }),
      );
      return { status: 201, json: post };
    }
    const match = /^\/api\/v1\/news\/posts\/([0-9a-f-]+)\/(archive|restore)$/.exec(path);
    if (method !== "POST" || !match) return undefined;
    const target = items.find((entry) => entry.post?.id === match[1]);
    if (!target?.post) return { status: 404 };
    if (!target.post.canArchive) return { status: 403 };
    if (match[2] === "archive") archived.add(target.post.id);
    else archived.delete(target.post.id);
    return { status: 204 };
  };
}
