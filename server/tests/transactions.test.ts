import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { openDatabase, migrate, type Database } from "../db.js";
import { loadConfig } from "../config.js";
import { createApp } from "../app.js";
import { seedDemo } from "../seed.js";
import { ugandaCalendarDay } from "../workflows.js";

let db: Database, server: Server, url: string;
type Client = { cookie: string; csrf: string };
let farmer: Client, operator: Client, admin: Client;
async function call(
  path: string,
  client?: Client,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
      ...(client ? { cookie: client.cookie, "x-csrf-token": client.csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function demo(role: string) {
  const result = await call("/api/auth/demo", undefined, "POST", { role });
  return { cookie: result.cookie!, csrf: result.body.csrfToken };
}
before(async () => {
  db = await openDatabase({ databasePath: ":memory:" });
  await migrate(db);
  await seedDemo(db);
  server = createApp(db, loadConfig({ AGRIBRIDGE_DEMO: "true" }), {}).listen(
    0,
    "127.0.0.1",
  );
  await new Promise<void>((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as any).port}`;
  farmer = await demo("farmer");
  operator = await demo("operator");
  admin = await demo("admin");
});
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await db.close();
});
const sale = () => ({
  kind: "sell",
  crop: "Maize",
  quantityKg: 250.5,
  unitPriceUgx: 1200,
  transactionDate: ugandaCalendarDay(),
  buyer: "Local buyer",
  seller: "Grace Nambi",
  farmId: "farm-grace-maize",
  paymentMethod: "mobile_money",
  paymentProvider: "MTN MoMo",
});

test("the server computes the total and assigns a reference", async () => {
  const created = await call("/api/transactions", farmer, "POST", {
    ...sale(),
    totalUgx: 1,
    reference: "TXN-FORGED",
  });
  assert.equal(created.status, 400, "server-owned fields are rejected");
  const ok = await call("/api/transactions", farmer, "POST", sale());
  assert.equal(ok.status, 201);
  assert.equal(ok.body.totalUgx, 300600);
  assert.match(ok.body.reference, /^TXN-[0-9A-F]{8}$/);
  assert.equal(ok.body.status, "pending");
  assert.equal(ok.body.recordedBy, "Grace Nambi");
  const updated = await call(
    `/api/transactions/${ok.body.id}`,
    farmer,
    "PATCH",
    {
      version: ok.body.version,
      quantityKg: 100,
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.body.totalUgx, 120000);
  assert.equal(updated.body.reference, ok.body.reference);
});

test("future dates are refused and only administrators change a date", async () => {
  const tomorrow = new Date(Date.now() + 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  const future = await call("/api/transactions", farmer, "POST", {
    ...sale(),
    transactionDate: tomorrow,
  });
  assert.equal(future.status, 400);
  const created = await call("/api/transactions", operator, "POST", {
    ...sale(),
    farmId: undefined,
  });
  assert.equal(created.status, 201);
  const yesterday = new Date(Date.now() - 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  const denied = await call(
    `/api/transactions/${created.body.id}`,
    operator,
    "PATCH",
    {
      version: created.body.version,
      transactionDate: yesterday,
    },
  );
  assert.equal(denied.status, 403);
  const allowed = await call(
    `/api/transactions/${created.body.id}`,
    admin,
    "PATCH",
    {
      version: created.body.version,
      transactionDate: yesterday,
    },
  );
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.transactionDate, yesterday);
});

test("farmers see their own transactions, including ones staff record for their farm", async () => {
  const forFarm = await call("/api/transactions", operator, "POST", {
    ...sale(),
    buyer: "Cooperative collection",
  });
  assert.equal(forFarm.status, 201);
  const own = await call("/api/bootstrap", farmer);
  const references = own.body.transactions.map((item: any) => item.reference);
  assert.ok(references.includes(forFarm.body.reference));
  assert.ok(
    !references.includes("TXN-SAMPLE03"),
    "cooperative-only sale stays private",
  );
  const staff = await call("/api/bootstrap", operator);
  assert.ok(
    staff.body.transactions.some(
      (item: any) => item.reference === "TXN-SAMPLE03",
    ),
  );
});
