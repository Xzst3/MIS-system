import test from "node:test";
import assert from "node:assert/strict";
import { canAccess, canWrite, roles } from "../lib/permissions.mjs";
test("volunteers cannot access donor, client or account data", () => {
  for (const section of [
    "donors",
    "clients",
    "referrals",
    "reports",
    "settings",
    "volunteers",
  ])
    assert.equal(canAccess("volunteer", section), false);
});
test("volunteers have read-only partner access and task write access", () => {
  assert.equal(canAccess("volunteer", "partners"), true);
  assert.equal(canWrite("volunteer", "partners"), false);
  assert.equal(canWrite("volunteer", "tasks"), true);
});
test("coordinators cannot read donors or manage accounts", () => {
  assert.equal(canAccess("coordinator", "donors"), false);
  assert.equal(canWrite("coordinator", "settings"), false);
  assert.equal(canWrite("coordinator", "clients"), true);
});
test("fundraising staff cannot access client pathways", () => {
  for (const section of ["clients", "referrals", "settings"])
    assert.equal(canAccess("fundraising", section), false);
  assert.equal(canWrite("fundraising", "donors"), true);
});
test("unknown roles and sections are denied", () => {
  assert.equal(canAccess("owner", "donors"), false);
  for (const role of roles) assert.equal(canAccess(role, "unknown"), false);
});
test("administrator can manage all operational sections", () => {
  for (const section of [
    "overview",
    "clients",
    "referrals",
    "donors",
    "partners",
    "volunteers",
    "tasks",
    "reports",
    "settings",
  ])
    assert.equal(canAccess("admin", section), true);
});
