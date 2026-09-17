import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    chatSession: {
      findMany: (...args: unknown[]) => findMany(...args),
      deleteMany: (...args: unknown[]) => deleteMany(...args),
    },
  },
}));

const { enforceChatSessionLimit, MAX_CHAT_SESSIONS_PER_USER } = await import(
  "@/lib/chat/session-retention"
);

describe("enforceChatSessionLimit", () => {
  it("does nothing when the user has 10 or fewer sessions", async () => {
    findMany.mockResolvedValueOnce([]);
    await enforceChatSessionLimit("user-1");
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      skip: MAX_CHAT_SESSIONS_PER_USER,
      select: { id: true },
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("permanently deletes every session past the cap, oldest first", async () => {
    findMany.mockResolvedValueOnce([{ id: "old-1" }, { id: "old-2" }]);
    await enforceChatSessionLimit("user-1");
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-1", "old-2"] } },
    });
  });
});
