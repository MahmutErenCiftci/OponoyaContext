import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { containsPattern, eq, ilike, readAll, resources, sql, users, type Database } from "../src/index.js";
import { createTestDatabase } from "../src/testing.js";

let database: Pick<Database, "db" | "close">;

beforeAll(async () => {
  database = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  await database.close();
});

function tracked(log: string[], name: string, ms: number) {
  return async () => {
    log.push(`${name}:start`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    log.push(`${name}:end`);
    return name;
  };
}

describe("readAll", () => {
  it("runs reads concurrently against the pool", async () => {
    const log: string[] = [];
    const results = await readAll(database.db, [tracked(log, "a", 20), tracked(log, "b", 5)]);
    expect(results).toEqual(["a", "b"]);
    expect(log.slice(0, 2)).toEqual(["a:start", "b:start"]);
  });

  it("runs reads one after another inside a transaction and keeps the result order and types", async () => {
    const log: string[] = [];
    const [names, rows, count] = await database.db.transaction(async (transaction) => readAll(transaction, [
      tracked(log, "a", 10),
      () => transaction.select({ id: users.id }).from(users),
      () => transaction.execute(sql`select 1 as one`).then(() => 1),
    ]));
    expect(names).toBe("a");
    expect(rows).toEqual([]);
    expect(count).toBe(1);
    expect(log).toEqual(["a:start", "a:end"]);
    const ordered: string[] = [];
    await database.db.transaction(async (transaction) => readAll(transaction, [tracked(ordered, "a", 20), tracked(ordered, "b", 5)]));
    expect(ordered).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });
});

describe("containsPattern", () => {
  it("matches wildcard characters literally", async () => {
    const owner = "00000000-0000-4000-8000-0000000000aa";
    await database.db.insert(users).values({ id: owner, email: "like@example.test", name: "Like" });
    await database.db.insert(resources).values([
      { ownerUserId: owner, name: "100% typed", slug: "typed", type: "framework" },
      { ownerUserId: owner, name: "1000 stars", slug: "stars", type: "framework" },
      { ownerUserId: owner, name: "snake_case", slug: "snake", type: "framework" },
      { ownerUserId: owner, name: "snakeXcase", slug: "snake-x", type: "framework" },
      { ownerUserId: owner, name: "C:\\tools", slug: "tools", type: "framework" },
    ]);
    const names = async (query: string) => (await database.db.select({ name: resources.name }).from(resources)
      .where(ilike(resources.name, containsPattern(query))).orderBy(resources.name)).map((row) => row.name);
    expect(await names("100%")).toEqual(["100% typed"]);
    expect(await names("snake_")).toEqual(["snake_case"]);
    expect(await names("C:\\t")).toEqual(["C:\\tools"]);
    // Order depends on the collation; only membership matters here.
    expect(new Set(await names("SNAKE"))).toEqual(new Set(["snake_case", "snakeXcase"]));
    await database.db.delete(users).where(eq(users.id, owner));
  });
});
