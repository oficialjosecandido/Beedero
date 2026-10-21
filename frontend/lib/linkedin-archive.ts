import { unzip } from "fflate";

/**
 * Opens the LinkedIn export in the browser and keeps only the four files the
 * importer reads, so the rest never leaves the person's computer.
 *
 * The archive LinkedIn sends holds everything: messages.csv (3.5 MB on a
 * modest account), Connections.csv, invitations, phone numbers, ad targeting.
 * The backend has always skipped those by name — but it still received them.
 * Stripping here turns "we don't read your messages" into "we never get
 * them", which is the only version of that promise that doesn't depend on
 * trusting us. The backend still filters by name too; this is not a reason to
 * stop doing it there.
 */

/** Basenames, lowercased — mirrors WANTED_FILES in accounts/linkedin_import.py. */
export const WANTED_FILES = ["profile.csv", "positions.csv", "education.csv", "skills.csv"];

/** Mirrors MAX_FILE_BYTES in the parser: no CSV we read is anywhere near this. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Unzipping needs the whole archive in memory, and a decade of messages can
 * run to hundreds of MB. Past this we ask for the four files instead, which
 * the picker and the backend both already accept.
 */
const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export class ArchiveError extends Error {}

const basename = (name: string) => name.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";

async function looksLikeZip(file: File): Promise<boolean> {
  if (file.name.toLowerCase().endsWith(".zip")) return true;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return ZIP_MAGIC.every((byte, i) => head[i] === byte);
}

function unzipWanted(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(
      data,
      {
        // Entries that fail this are never decompressed, so messages.csv is
        // not just dropped afterwards — it is never read.
        filter: (entry) =>
          WANTED_FILES.includes(basename(entry.name)) && entry.originalSize <= MAX_FILE_BYTES,
      },
      (err, unzipped) => (err ? reject(err) : resolve(unzipped))
    );
  });
}

/**
 * The files to upload: the four CSVs, whether they came inside a ZIP or were
 * picked loose. Anything else the person selected is dropped here.
 *
 * Throws ArchiveError with a message meant to be shown as-is.
 */
export async function keepOnlyWantedFiles(selected: File[]): Promise<File[]> {
  const kept = new Map<string, File>();

  for (const file of selected) {
    if (await looksLikeZip(file)) {
      if (file.size > MAX_ARCHIVE_BYTES) {
        throw new ArchiveError(
          "That archive is too big to open in the browser. Unzip it and choose Profile.csv, " +
            "Positions.csv, Education.csv and Skills.csv — those are the four we read."
        );
      }
      let unzipped: Record<string, Uint8Array>;
      try {
        unzipped = await unzipWanted(new Uint8Array(await file.arrayBuffer()));
      } catch {
        throw new ArchiveError("We couldn't open that ZIP file. Is it the one LinkedIn sent you?");
      }
      for (const [name, bytes] of Object.entries(unzipped)) {
        const base = basename(name);
        // The export has one of each; if a stray duplicate turns up, first wins.
        if (!kept.has(base)) {
          kept.set(base, new File([bytes as BlobPart], base, { type: "text/csv" }));
        }
      }
      continue;
    }

    const base = basename(file.name);
    if (WANTED_FILES.includes(base) && file.size <= MAX_FILE_BYTES && !kept.has(base)) {
      kept.set(base, file);
    }
  }

  if (kept.size === 0) {
    throw new ArchiveError(
      "We couldn't find Profile.csv, Positions.csv, Education.csv or Skills.csv in what you chose. " +
        "Pick the ZIP LinkedIn sent you, or those files on their own."
    );
  }
  return [...kept.values()];
}
