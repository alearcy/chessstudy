import db from "@/db/database";
import { createStableId } from "@/db/recordMetadata";
import type { LocalProfile } from "@/types";

export type PersistedLocalProfile = LocalProfile & { id: number };

export async function createLocalProfile(name: string): Promise<PersistedLocalProfile> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Il nome del profilo è obbligatorio.");
  }

  const now = new Date();
  const profile: LocalProfile = {
    uid: createStableId(),
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
  };
  const id = (await db.profiles.add(profile)) as number;
  return { ...profile, id };
}

export async function ensureDefaultProfile(): Promise<PersistedLocalProfile> {
  return db.transaction("rw", db.profiles, async () => {
    const existing = await db.profiles.orderBy("createdAt").first();
    if (existing?.id != null) {
      return existing as PersistedLocalProfile;
    }

    return createLocalProfile("Principale");
  });
}
