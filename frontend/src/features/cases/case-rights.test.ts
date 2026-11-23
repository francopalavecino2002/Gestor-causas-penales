import { describe, expect, it } from "vitest";

import { caseRights } from "@/features/cases/case-rights";
import { LAWYER_LUCIA, LAWYER_PAULA } from "@/test/agenda-fixtures";
import { ARCHIVED_DETAIL, DETAIL_EJEMPLAR, DETAIL_MODELO } from "@/test/case-fixtures";

describe("caseRights", () => {
  it("lets every member edit a case they see, and only the owner or the responsible reserve it", () => {
    expect(caseRights({ id: LAWYER_PAULA.id, role: "ADMIN_STAFF" }, DETAIL_MODELO)).toEqual({
      edit: true,
      changeReserved: false,
    });
    expect(caseRights({ id: LAWYER_PAULA.id, role: "LAWYER" }, DETAIL_EJEMPLAR)).toEqual({
      edit: true,
      changeReserved: true,
    });
    expect(caseRights({ id: "someone-else", role: "OWNER" }, DETAIL_EJEMPLAR).changeReserved).toBe(
      true,
    );
  });

  it("makes an archived case read only", () => {
    expect(caseRights({ id: LAWYER_LUCIA.id, role: "OWNER" }, ARCHIVED_DETAIL)).toEqual({
      edit: false,
      changeReserved: false,
    });
    expect(caseRights(null, DETAIL_MODELO).edit).toBe(false);
  });
});
