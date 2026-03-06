import { describe, expect, it } from "vitest";
import { ChatMemory } from "../src/services/chatMemory";

describe("ChatMemory", () => {
  it("keeps only configured in-memory history size", () => {
    const memory = new ChatMemory(3, 15);
    const chatId = "chat-1";

    memory.pushMessage(chatId, {
      userId: "u1",
      username: "user1",
      text: "m1",
      date_time: "2026-03-06T10:00:00.000Z",
    });
    memory.pushMessage(chatId, {
      userId: "u2",
      username: "user2",
      text: "m2",
      date_time: "2026-03-06T10:00:01.000Z",
    });
    memory.pushMessage(chatId, {
      userId: "u3",
      username: "user3",
      text: "m3",
      date_time: "2026-03-06T10:00:02.000Z",
    });
    memory.pushMessage(chatId, {
      userId: "u4",
      username: "user4",
      text: "m4",
      date_time: "2026-03-06T10:00:03.000Z",
    });

    const context = memory.getContextFromOtherUsers(chatId, "none");
    expect(context).toHaveLength(3);
    expect(context.map((m) => m.text)).toEqual(["m2", "m3", "m4"]);
  });

  it("returns only recent messages from other users", () => {
    const memory = new ChatMemory(10, 2);
    const chatId = "chat-2";

    memory.pushMessage(chatId, {
      userId: "u1",
      username: "user1",
      text: "own-1",
      date_time: "2026-03-06T10:01:00.000Z",
    });
    memory.pushMessage(chatId, {
      userId: "u2",
      username: "user2",
      text: "other-1",
      date_time: "2026-03-06T10:01:01.000Z",
    });
    memory.pushMessage(chatId, {
      userId: "u3",
      username: "user3",
      text: "other-2",
      date_time: "2026-03-06T10:01:02.000Z",
    });
    memory.pushMessage(chatId, {
      userId: "u1",
      username: "user1",
      text: "own-2",
      date_time: "2026-03-06T10:01:03.000Z",
    });
    memory.pushMessage(chatId, {
      userId: "u4",
      username: "user4",
      text: "other-3",
      date_time: "2026-03-06T10:01:04.000Z",
    });

    const context = memory.getContextFromOtherUsers(chatId, "u1");
    expect(context.map((m) => m.text)).toEqual(["other-2", "other-3"]);
  });
});
