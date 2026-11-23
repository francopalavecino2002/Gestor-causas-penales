import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { cleanReport, reportWithErrors } from "@/test/import-fixtures";
import {
  DEMO_ME,
  json,
  problem,
  problemWith,
  signedIn,
  type RecordedRequest,
} from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const csv = (name = "personas.csv", content = "tipo_persona;nombres\nhumana;Juan") =>
  new File([content], name, { type: "text/csv" });

const imports = (requests: RecordedRequest[]) =>
  requests.filter((request) => request.path.startsWith("/api/v1/imports/"));

async function chooseKind(title: string) {
  fireEvent.click(await screen.findByRole("radio", { name: new RegExp(`^${title}`) }));
  fireEvent.click(screen.getByRole("button", { name: "Continuá" }));
  await screen.findByRole("heading", { name: `Subí la planilla de ${title.toLowerCase()}` });
}

function upload(file: File) {
  fireEvent.change(screen.getByLabelText(/Elegí el archivo/), { target: { files: [file] } });
}

describe("ImportPage", () => {
  it("explains the order, offers each template and asks to choose before going on", async () => {
    signedIn();
    renderApp("/importar");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Importar planillas" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/primero las personas, después las causas/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "persons",
      "cases",
      "hearings",
    ]);
    expect(screen.getByRole("link", { name: "Descargá la plantilla de causas" })).toHaveAttribute(
      "href",
      "/api/v1/imports/cases/template",
    );
    const steps = screen.getByRole("list", { name: "Pasos de la importación" });
    expect(within(steps).getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "Continuá" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elegí qué vas a importar.");

    await chooseKind("Personas");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Subí la planilla de personas" })).toHaveFocus(),
    );
    expect(within(steps).getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/\.csv o \.xlsx, de hasta 2 MB y 1000 filas/)).toBeInTheDocument();
  });

  it("checks the file with a dry run and lists what to fix in each row, with no way to save", async () => {
    const requests = signedIn(undefined, {
      "POST /api/v1/imports/persons": () => json(200, reportWithErrors("persons")),
    });
    renderApp("/importar");
    await chooseKind("Personas");

    upload(csv());

    expect(
      await screen.findByRole("heading", { name: "Hay 2 filas para corregir" }),
    ).toBeInTheDocument();
    const [request] = imports(requests);
    expect(request?.query).toEqual({ dryRun: "true" });
    expect(request?.headers["x-xsrf-token"]).toBe("token-1");
    expect(((request?.body as FormData).get("file") as File).name).toBe("personas.csv");

    expect(screen.getByText("Filas en la planilla").nextElementSibling).toHaveTextContent("5");
    expect(screen.getByText("Con errores").nextElementSibling).toHaveTextContent("2");
    expect(
      screen.getByText(/No se va a guardar nada hasta que corrijas esas filas/),
    ).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Qué corregir en cada fila" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "3numero_documentoEl número no tiene el formato del tipo de documento.",
      "apellidosUna persona humana necesita apellidos.",
      "6tipo_personaUna persona jurídica no tiene nombres, apellidos ni fecha de nacimiento.",
    ]);
    expect(screen.queryByRole("button", { name: /Confirmá/ })).not.toBeInTheDocument();
    expect(screen.getByText("Mirá las 3 filas sin errores")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Subí la planilla corregida" }));
    expect(
      await screen.findByRole("heading", { name: "Subí la planilla de personas" }),
    ).toBeInTheDocument();
    expect(imports(requests)).toHaveLength(1);
  });

  it("saves only after the explicit confirmation and then links to the imported area", async () => {
    const requests = signedIn(undefined, {
      "POST /api/v1/imports/persons": ({ query }) =>
        json(200, cleanReport("persons", query.dryRun !== "false")),
    });
    const { router } = renderApp("/importar");
    await chooseKind("Personas");

    upload(csv());

    expect(
      await screen.findByRole("heading", { name: "Revisá antes de guardar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Todo en orden: las 4 filas se pueden importar.")).toBeInTheDocument();
    expect(screen.getByText("Al confirmar se van a crear 4 personas.")).toBeInTheDocument();
    expect(imports(requests).map((request) => request.query.dryRun)).toEqual(["true"]);

    fireEvent.click(screen.getByRole("button", { name: "Confirmá e importá 4 filas" }));

    const done = await screen.findByRole("heading", { name: "Listo: importaste las personas" });
    await waitFor(() => expect(done).toHaveFocus());
    expect(imports(requests).map((request) => request.query.dryRun)).toEqual(["true", "false"]);
    expect(screen.getByText(/Se crearon 4 personas\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mirá las personas" })).toHaveAttribute(
      "href",
      "/personas",
    );

    fireEvent.click(screen.getByRole("button", { name: "Importá las causas" }));
    expect(
      await screen.findByRole("heading", { name: "Subí la planilla de causas" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/importar");
  });

  it("rejects files that cannot be valid without sending them", async () => {
    const requests = signedIn();
    renderApp("/importar");
    await chooseKind("Audiencias");

    upload(csv("audiencias.xls"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Los archivos .xls viejos no se pueden leer",
    );

    upload(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "audiencias.csv"));
    expect(await screen.findByRole("alert")).toHaveTextContent("el máximo es 2 MB");

    upload(csv("audiencias.pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El archivo tiene que ser una planilla .csv o .xlsx.",
    );
    expect(imports(requests)).toHaveLength(0);
  });

  it("accepts a dropped file", async () => {
    const requests = signedIn(undefined, {
      "POST /api/v1/imports/hearings": () => json(200, cleanReport("hearings")),
    });
    renderApp("/importar");
    await chooseKind("Audiencias");

    const zone = screen.getByLabelText(/Elegí el archivo/).closest("label") as HTMLElement;
    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute("data-dragging", "true");
    fireEvent.drop(zone, { dataTransfer: { files: [csv("audiencias.xlsx")] } });

    expect(
      await screen.findByRole("heading", { name: "Revisá antes de guardar" }),
    ).toBeInTheDocument();
    expect(imports(requests)[0]?.path).toBe("/api/v1/imports/hearings");
  });

  it("shows why the server could not read the file, with the headers to check", async () => {
    signedIn(undefined, {
      "POST /api/v1/imports/cases": () =>
        problemWith(400, "import-invalid-file", {
          detail: "Los encabezados no coinciden con la plantilla (faltan columnas: legajo_mpf).",
          headers: ["legajo_mpf"],
        }),
    });
    renderApp("/importar");
    await chooseKind("Causas");

    upload(csv("causas.csv"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos leer la planilla");
    expect(alert).toHaveTextContent("faltan columnas: legajo_mpf");
    expect(within(alert).getByRole("listitem")).toHaveTextContent("legajo_mpf");
    expect(within(alert).getByRole("link", { name: "plantilla de causas" })).toHaveAttribute(
      "href",
      "/api/v1/imports/cases/template",
    );
    expect(screen.getByRole("heading", { name: "Subí la planilla de causas" })).toBeInTheDocument();
  });

  it("says when the server cannot be reached", async () => {
    signedIn(undefined, {
      "POST /api/v1/imports/persons": () => Promise.reject(new TypeError("Failed to fetch")),
    });
    renderApp("/importar");
    await chooseKind("Personas");

    upload(csv());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No hay conexión con el servidorRevisá tu conexión a internet y volvé a intentar. No se guardó nada.",
    );
  });

  it("shows the new report when the confirmation finds errors, and saves nothing", async () => {
    signedIn(undefined, {
      "POST /api/v1/imports/cases": ({ query }) =>
        query.dryRun === "false"
          ? problemWith(422, "import-has-errors", { report: reportWithErrors("cases", false) })
          : json(200, cleanReport("cases")),
    });
    renderApp("/importar");
    await chooseKind("Causas");
    upload(csv("causas.csv"));

    expect(
      await screen.findByText("Al confirmar se van a crear 2 causas, 3 imputados y 1 persona."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmá e importá 3 filas" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se guardó nada: hay filas con errores",
    );
    expect(screen.getByRole("heading", { name: "Hay 1 fila para corregir" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Hay 1 fila para corregir" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Qué corregir en cada fila" });
    expect(table).toHaveTextContent("legajo_mpfYa existe una causa con ese legajo.");
    expect(screen.queryByRole("button", { name: /Confirmá/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revisá la planilla de nuevo" }),
    ).not.toBeInTheDocument();
  });

  it("offers to check again after a concurrent change", async () => {
    const requests = signedIn(undefined, {
      "POST /api/v1/imports/hearings": ({ query }) =>
        query.dryRun === "false"
          ? problem(409, "concurrent-change")
          : json(200, cleanReport("hearings")),
    });
    renderApp("/importar");
    await chooseKind("Audiencias");
    upload(csv("audiencias.csv"));

    fireEvent.click(await screen.findByRole("button", { name: "Confirmá e importá 2 filas" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se guardó nada: hubo un cambio al mismo tiempo");
    expect(alert).toHaveTextContent("Alguien del estudio cargó un dato igual");

    fireEvent.click(screen.getByRole("button", { name: "Revisá la planilla de nuevo" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(imports(requests).map((request) => request.query.dryRun)).toEqual([
      "true",
      "false",
      "true",
    ]);
    expect(screen.getByRole("button", { name: "Confirmá e importá 2 filas" })).toBeEnabled();
  });

  it("tells paralegals and administrative staff they cannot import", async () => {
    const requests = signedIn({ ...DEMO_ME, role: "PARALEGAL" });
    renderApp("/importar");

    expect(
      await screen.findByRole("heading", { name: "No tenés permiso para importar planillas" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volvé a la agenda" })).toHaveAttribute("href", "/");
    expect(imports(requests)).toHaveLength(0);
  });

  it("shows the same state when the server refuses the import", async () => {
    signedIn(
      { ...DEMO_ME, role: "LAWYER" },
      {
        "POST /api/v1/imports/persons": () => problem(403, "access-denied"),
      },
    );
    renderApp("/importar");
    await chooseKind("Personas");

    upload(csv());

    expect(
      await screen.findByRole("heading", { name: "No tenés permiso para importar planillas" }),
    ).toBeInTheDocument();
  });

  it("is offered from an empty case list, only to those who can import", async () => {
    signedIn();
    const first = renderApp("/causas");
    expect(await screen.findByRole("link", { name: "Importá desde una planilla" })).toHaveAttribute(
      "href",
      "/importar",
    );
    first.unmount();

    signedIn({ ...DEMO_ME, role: "ADMIN_STAFF" });
    renderApp("/causas");
    expect(
      await screen.findByRole("heading", { name: "Todavía no hay causas" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Importá desde una planilla" }),
    ).not.toBeInTheDocument();
  });

  it("is reachable from the settings index", async () => {
    signedIn();
    const { router } = renderApp("/ajustes");

    const entry = await screen.findByRole("region", { name: "Tus datos" });
    fireEvent.click(within(entry).getByRole("link", { name: /Importar planillas/ }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Importar planillas" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/importar");
  });
});
