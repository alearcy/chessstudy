import db from "@/db/database";
import type { Board, Lesson, LocalProfile, Move } from "@/types";

const BACKUP_FORMAT = "chessstudy-backup";
const BACKUP_VERSION = 1;
export const DATABASE_BACKUP_RESTORED_EVENT = "chessstudy:database-backup-restored";

interface DatabaseBackupV1 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  data: {
    profiles: LocalProfile[];
    lessons: Lesson[];
    boards: Board[];
    moves: Move[];
  };
}

export interface DatabaseBackupSummary {
  profiles: number;
  lessons: number;
  boards: number;
  moves: number;
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

function backupSummary(backup: DatabaseBackupV1): DatabaseBackupSummary {
  return {
    profiles: backup.data.profiles.length,
    lessons: backup.data.lessons.length,
    boards: backup.data.boards.length,
    moves: backup.data.moves.length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new BackupValidationError(`${label} non è valido.`);
  return value;
}

function requireArray(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new BackupValidationError(`${label} non è valido.`);
  }
  return value;
}

function requireInteger(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new BackupValidationError(`${label}.${key} non è valido.`);
  }
  return Number(value);
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new BackupValidationError(`${label}.${key} non è valido.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, label: string): void {
  const value = record[key];
  if (value != null && typeof value !== "string") {
    throw new BackupValidationError(`${label}.${key} non è valido.`);
  }
}

function requireDate(record: Record<string, unknown>, key: string, label: string): Date {
  const value = record[key];
  if (typeof value !== "string") {
    throw new BackupValidationError(`${label}.${key} non è valido.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new BackupValidationError(`${label}.${key} non è una data ISO valida.`);
  }
  return date;
}

function validateUniqueIds(
  records: Record<string, unknown>[],
  label: string,
  globalUids: Set<string>,
): Set<number> {
  const ids = new Set<number>();
  for (const [index, record] of records.entries()) {
    const itemLabel = `${label}[${index}]`;
    const id = requireInteger(record, "id", itemLabel);
    const uid = requireString(record, "uid", itemLabel);
    if (ids.has(id)) throw new BackupValidationError(`${label} contiene ID duplicati.`);
    if (globalUids.has(uid)) {
      throw new BackupValidationError("Il backup contiene identificatori stabili duplicati.");
    }
    ids.add(id);
    globalUids.add(uid);
  }
  return ids;
}

function validateAndReviveBackup(value: unknown): DatabaseBackupV1 {
  const root = requireRecord(value, "Backup");
  if (root.format !== BACKUP_FORMAT || root.version !== BACKUP_VERSION) {
    throw new BackupValidationError("Formato o versione del backup non supportati.");
  }
  requireDate(root, "createdAt", "Backup");
  const data = requireRecord(root.data, "Backup.data");
  const profiles = requireArray(data.profiles, "Backup.data.profiles");
  const lessons = requireArray(data.lessons, "Backup.data.lessons");
  const boards = requireArray(data.boards, "Backup.data.boards");
  const moves = requireArray(data.moves, "Backup.data.moves");
  const globalUids = new Set<string>();
  const profileIds = validateUniqueIds(profiles, "profiles", globalUids);
  const lessonIds = validateUniqueIds(lessons, "lessons", globalUids);
  const boardIds = validateUniqueIds(boards, "boards", globalUids);
  validateUniqueIds(moves, "moves", globalUids);

  const revivedProfiles = profiles.map((record, index) => {
    const label = `profiles[${index}]`;
    requireString(record, "name", label);
    return {
      ...record,
      createdAt: requireDate(record, "createdAt", label),
      updatedAt: requireDate(record, "updatedAt", label),
    } as unknown as LocalProfile;
  });

  const revivedLessons = lessons.map((record, index) => {
    const label = `lessons[${index}]`;
    const profileId = requireInteger(record, "profileId", label);
    if (!profileIds.has(profileId)) {
      throw new BackupValidationError(`${label} riferisce un profilo inesistente.`);
    }
    requireString(record, "title", label);
    optionalString(record, "description", label);
    if (record.mode !== "study" && record.mode !== "analysis") {
      throw new BackupValidationError(`${label}.mode non è valido.`);
    }
    if (record.isFavorite != null && typeof record.isFavorite !== "boolean") {
      throw new BackupValidationError(`${label}.isFavorite non è valido.`);
    }
    if (!Array.isArray(record.searchTerms) || !record.searchTerms.every((term) => typeof term === "string")) {
      throw new BackupValidationError(`${label}.searchTerms non è valido.`);
    }
    return {
      ...record,
      createdAt: requireDate(record, "createdAt", label),
      updatedAt: requireDate(record, "updatedAt", label),
    } as unknown as Lesson;
  });

  const revivedBoards = boards.map((record, index) => {
    const label = `boards[${index}]`;
    const lessonId = requireInteger(record, "lessonId", label);
    if (!lessonIds.has(lessonId)) {
      throw new BackupValidationError(`${label} riferisce una lezione inesistente.`);
    }
    requireString(record, "title", label);
    requireString(record, "fen", label);
    if (!Number.isInteger(record.order) || Number(record.order) < 0) {
      throw new BackupValidationError(`${label}.order non è valido.`);
    }
    return {
      ...record,
      createdAt: requireDate(record, "createdAt", label),
      updatedAt: requireDate(record, "updatedAt", label),
    } as unknown as Board;
  });

  const revivedMoves = moves.map((record, index) => {
    const label = `moves[${index}]`;
    const boardId = requireInteger(record, "boardId", label);
    if (!boardIds.has(boardId)) {
      throw new BackupValidationError(`${label} riferisce una scacchiera inesistente.`);
    }
    requireString(record, "moveNotation", label);
    requireString(record, "fen", label);
    if (!Number.isInteger(record.order) || Number(record.order) < 0) {
      throw new BackupValidationError(`${label}.order non è valido.`);
    }
    if (record.parentId != null) {
      if (!Number.isInteger(record.parentId) || Number(record.parentId) <= 0) {
        throw new BackupValidationError(`${label}.parentId non è valido.`);
      }
    }
    return {
      ...record,
      createdAt: requireDate(record, "createdAt", label),
      updatedAt: requireDate(record, "updatedAt", label),
    } as unknown as Move;
  });

  const movesByBoard = new Map<number, Move[]>();
  for (const move of revivedMoves) {
    const boardMoves = movesByBoard.get(move.boardId) ?? [];
    boardMoves.push(move);
    movesByBoard.set(move.boardId, boardMoves);
  }
  for (const boardMoves of movesByBoard.values()) {
    boardMoves.sort((left, right) => left.order - right.order || (left.id ?? 0) - (right.id ?? 0));
    const orders = new Set<number>();
    for (const [index, move] of boardMoves.entries()) {
      if (orders.has(move.order)) {
        throw new BackupValidationError("Una scacchiera contiene ordini di mossa duplicati.");
      }
      orders.add(move.order);
      move.parentId = index === 0 ? null : (boardMoves[index - 1].id ?? null);
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: String(root.createdAt),
    data: {
      profiles: revivedProfiles,
      lessons: revivedLessons,
      boards: revivedBoards,
      moves: revivedMoves,
    },
  };
}

export async function createDatabaseBackupJson(): Promise<string> {
  const [profiles, lessons, boards, moves] = await db.transaction(
    "r",
    db.profiles,
    db.lessons,
    db.boards,
    db.moves,
    () => Promise.all([
      db.profiles.toArray(),
      db.lessons.toArray(),
      db.boards.toArray(),
      db.moves.toArray(),
    ]),
  );

  const backup: DatabaseBackupV1 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data: { profiles, lessons, boards, moves },
  };
  return JSON.stringify(backup, null, 2);
}

function parseDatabaseBackupJson(json: string): DatabaseBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupValidationError("Il file non contiene JSON valido.");
  }
  return validateAndReviveBackup(parsed);
}

export function inspectDatabaseBackupJson(json: string): DatabaseBackupSummary {
  return backupSummary(parseDatabaseBackupJson(json));
}

export async function restoreDatabaseBackupJson(json: string): Promise<DatabaseBackupSummary> {
  const backup = parseDatabaseBackupJson(json);

  await db.transaction("rw", db.profiles, db.lessons, db.boards, db.moves, async () => {
    await db.moves.clear();
    await db.boards.clear();
    await db.lessons.clear();
    await db.profiles.clear();
    if (backup.data.profiles.length > 0) await db.profiles.bulkAdd(backup.data.profiles);
    if (backup.data.lessons.length > 0) await db.lessons.bulkAdd(backup.data.lessons);
    if (backup.data.boards.length > 0) await db.boards.bulkAdd(backup.data.boards);
    if (backup.data.moves.length > 0) await db.moves.bulkAdd(backup.data.moves);
  });

  return backupSummary(backup);
}
