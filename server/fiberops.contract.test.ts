import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  employeeAssignments,
  employeeDocuments,
  employeeQualifications,
  employees,
  fieldEquipment,
  fiberDrums,
  operationalAuditLogs,
  permits,
  residencyPermits,
  workRoutes,
} from "../drizzle/schema";
import { operationsRouter } from "./routers/operations";
import { workforceRouter } from "./routers/workforce";

describe("FiberOps operational contracts", () => {
  it("defines the required workforce compliance tables", () => {
    expect(getTableName(employees)).toBe("employees");
    expect(getTableName(residencyPermits)).toBe("residencyPermits");
    expect(getTableName(employeeQualifications)).toBe("employeeQualifications");
    expect(getTableName(employeeDocuments)).toBe("employeeDocuments");
    expect(getTableName(employeeAssignments)).toBe("employeeAssignments");
    expect(residencyPermits.expiryDate.name).toBe("expiryDate");
    expect(employeeQualifications.status.name).toBe("status");
  });

  it("defines operating assets, permits, routes, and audit entities", () => {
    expect(getTableName(fiberDrums)).toBe("fiberDrums");
    expect(getTableName(fieldEquipment)).toBe("fieldEquipment");
    expect(getTableName(permits)).toBe("permits");
    expect(getTableName(workRoutes)).toBe("workRoutes");
    expect(getTableName(operationalAuditLogs)).toBe("operationalAuditLogs");
    expect(operationalAuditLogs.action.name).toBe("action");
  });

  it("exposes the required protected business actions", () => {
    const workforceProcedures = Object.keys(workforceRouter._def.procedures);
    const operationsProcedures = Object.keys(operationsRouter._def.procedures);
    expect(workforceProcedures).toEqual(expect.arrayContaining(["list", "createEmployee", "updateEmployee", "deleteEmployee", "renewResidency", "createQualification", "updateQualification", "createDocument", "updateDocument", "assignEmployee", "updateAssignment"]));
    expect(operationsProcedures).toEqual(expect.arrayContaining(["list", "createDrum", "updateDrum", "createEquipment", "assignEquipment", "createPermit", "renewPermit", "createRoute"]));
  });
});
