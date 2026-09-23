import assert from "node:assert/strict";
import { test } from "node:test";
import { generateFallbackRotation, validateRotation } from "../dist/services/rotation.service.js";

test("local rotation minimizes appearances without in-period substitutions", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    roles: index === 0 ? ["Portiere"] : [index < 3 ? "Difensore" : index < 7 ? "Centrocampista" : "Attaccante"],
  }));
  const request = { periodCount: 3, minutesPerPeriod: 20, playersOnField: 7, rolePolicy: "preferred", players };
  const periods = generateFallbackRotation(request);
  const counts = players.map((player) => periods.filter((period) => period.assignments.some((assignment) => assignment.playerId === player.id)).length);
  assert.equal(periods.length, 3);
  assert.ok(periods.every((period) => new Set(period.assignments.map((assignment) => assignment.playerId)).size === 7));
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  assert.equal(validateRotation(request, periods).errors.length, 0);
});

test("strict roles keep the only goalkeeper in goal", () => {
  const players = [
    { id: 1, roles: ["Portiere"] },
    ...Array.from({ length: 7 }, (_, index) => ({ id: index + 2, roles: [index < 2 ? "Difensore" : index < 5 ? "Centrocampista" : "Attaccante"] })),
  ];
  const request = { periodCount: 3, minutesPerPeriod: 20, playersOnField: 7, rolePolicy: "strict", players };
  const periods = generateFallbackRotation(request);
  assert.ok(periods.every((period) => period.assignments.find((assignment) => assignment.slot === "portiere")?.playerId === 1));
  assert.equal(validateRotation(request, periods).errors.length, 0);
});

test("local rotation prefers the natural foot on left and right slots", () => {
  const players = [
    { id: 1, roles: ["Portiere"], preferredFoot: "both" },
    { id: 2, roles: ["Difensore"], preferredFoot: "left" },
    { id: 3, roles: ["Difensore"], preferredFoot: "right" },
    { id: 4, roles: ["Centrocampista"], preferredFoot: "both" },
    { id: 5, roles: ["Esterno"], preferredFoot: "left" },
    { id: 6, roles: ["Esterno"], preferredFoot: "right" },
    { id: 7, roles: ["Attaccante"], preferredFoot: "both" },
  ];
  const request = { periodCount: 1, minutesPerPeriod: 20, playersOnField: 7, rolePolicy: "strict", players };
  const [period] = generateFallbackRotation(request);
  assert.equal(period.assignments.find((assignment) => assignment.slot === "difensoreSinistro")?.playerId, 2);
  assert.equal(period.assignments.find((assignment) => assignment.slot === "difensoreDestro")?.playerId, 3);
  assert.equal(period.assignments.find((assignment) => assignment.slot === "fasciaSinistra")?.playerId, 5);
  assert.equal(period.assignments.find((assignment) => assignment.slot === "fasciaDestra")?.playerId, 6);
});
