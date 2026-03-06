import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonStorageService } from "../src/storage/jsonStorageService";

const tempDirs: string[] = [];

async function createTempStoragePath() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ainquisitor-test-"));
  tempDirs.push(dir);
  return path.join(dir, "storage.json");
}

async function flushWrites() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("JsonStorageService", () => {
  it("creates empty storage file on first load", async () => {
    const storagePath = await createTempStoragePath();
    const storage = new JsonStorageService(storagePath);

    await storage.load();

    const raw = await readFile(storagePath, "utf-8");
    expect(JSON.parse(raw)).toEqual({ chats: {} });
  });

  it("loads existing data from disk", async () => {
    const storagePath = await createTempStoragePath();
    const initial = {
      chats: {
        "chat-1": {
          users: {
            "user-1": {
              sins_count: 2,
              sins: [],
              punishments: [],
            },
          },
        },
      },
    };

    const storage = new JsonStorageService(storagePath);
    await storage.load();
    storage.update((data) => {
      Object.assign(data, initial);
    });
    await flushWrites();

    const reloaded = new JsonStorageService(storagePath);
    await reloaded.load();

    expect(reloaded.read()).toEqual(initial);
  });

  it("persists update mutations to file", async () => {
    const storagePath = await createTempStoragePath();
    const storage = new JsonStorageService(storagePath);
    await storage.load();

    storage.update((data) => {
      data.chats["chat-2"] = {
        users: {
          "user-2": {
            sins_count: 1,
            sins: [
              {
                date_time: "2026-03-06T10:12:00.000Z",
                sin: "Лень",
                manifestation: "тянул время",
              },
            ],
            punishments: [],
          },
        },
      };
    });
    await flushWrites();

    const raw = await readFile(storagePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.chats["chat-2"].users["user-2"].sins_count).toBe(1);
  });
});
