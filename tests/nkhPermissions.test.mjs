import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "../app/lib/nkhPermissions.ts";
test("finance and executive are master only", () => {
  for (const role of ["Supervisor","Team",null,"unknown"]) {
    assert.equal(hasPermission(role,"finance.read"),false);
    assert.equal(hasPermission(role,"finance.write"),false);
    assert.equal(hasPermission(role,"finance.approve"),false);
    assert.equal(hasPermission(role,"executive.read"),false);
  }
  assert.equal(hasPermission(" Master ","finance.approve"),true);
});
test("operational capabilities are scoped", () => {
  assert.equal(hasPermission("Supervisor","operations.manage"),true);
  assert.equal(hasPermission("Team","operations.manage"),false);
  assert.equal(hasPermission("Team","operations.assigned"),true);
  assert.equal(hasPermission("Team","payroll.own"),true);
  assert.equal(hasPermission("Team","administration.manage"),false);
});
