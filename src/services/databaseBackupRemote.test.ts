import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import {
  BackupValidationError,
  inspectDatabaseBackupJson,
  restoreDatabaseBackupJson,
} from "@/services/databaseBackupService";

const validBackup = {
  format: "chessstudy-backup",
  version: 1,
  createdAt: "2026-07-18T10:00:00.000Z",
  data: {
    profiles: [{
      id: 1,
      uid: "00000000-0000-4000-8000-000000000001",
      name: "Principale",
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T10:00:00.000Z",
    }],
    lessons: [{
      id: 10,
      uid: "10000000-0000-4000-8000-000000000010",
      profileId: 1,
      title: "Importata",
      description: "",
      mode: "study",
      isFavorite: false,
      searchTerms: ["importata"],
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T10:00:00.000Z",
    }],
    boards: [{
      id: 20,
      uid: "20000000-0000-4000-8000-000000000020",
      lessonId: 10,
      title: "Board",
      fen: "start",
      notes: "",
      arrows: [],
      highlights: [],
      order: 0,
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T10:00:00.000Z",
    }],
    moves: [{
      id: 30,
      uid: "30000000-0000-4000-8000-000000000030",
      boardId: 20,
      parentId: 999,
      moveNotation: "e4",
      fen: "after-e4",
      order: 0,
      comment: "",
      arrows: [],
      highlights: [],
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T10:00:00.000Z",
    }],
  },
};

describe("remote database backup import", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("inspects the legacy v1 format without counting profiles as remote data", () => {
    expect(inspectDatabaseBackupJson(JSON.stringify(validBackup))).toEqual({
      profiles: 1,
      lessons: 1,
      boards: 1,
      moves: 1,
    });
  });

  it("sends one validated payload to the atomic import RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { profiles: 1, lessons: 1, boards: 1, moves: 1 },
      error: null,
    });

    await expect(
      restoreDatabaseBackupJson(JSON.stringify(validBackup)),
    ).resolves.toEqual({ profiles: 1, lessons: 1, boards: 1, moves: 1 });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("import_database_backup_v1", {
      p_backup: expect.objectContaining({
        format: "chessstudy-backup",
        version: 1,
      }),
    });
  });

  it("rejects broken relationships before calling the database", async () => {
    const broken = structuredClone(validBackup);
    broken.data.boards[0].lessonId = 999;

    await expect(
      restoreDatabaseBackupJson(JSON.stringify(broken)),
    ).rejects.toBeInstanceOf(BackupValidationError);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
