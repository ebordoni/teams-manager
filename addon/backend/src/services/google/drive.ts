import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

const FOLDER_MIME = "application/vnd.google-apps.folder";

async function findOrCreateFolder(
  auth: OAuth2Client,
  name: string,
  parentId?: string,
): Promise<string> {
  const drive = google.drive({ version: "v3", auth });
  const parentClause = parentId
    ? ` and '${parentId}' in parents`
    : " and 'root' in parents";
  const { data } = await drive.files.list({
    q: `mimeType = '${FOLDER_MIME}' and name = '${name}' and trashed = false${parentClause}`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const existing = data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error(`Impossibile creare la cartella Drive "${name}"`);
  }
  return created.data.id;
}

/** Assicura che esista Drive/GIPS Calcio/Comunicazioni e ne restituisce l'id. */
export async function ensureCommunicationsFolder(
  auth: OAuth2Client,
): Promise<string> {
  const rootFolder = await findOrCreateFolder(auth, "GIPS Calcio");
  return findOrCreateFolder(auth, "Comunicazioni", rootFolder);
}

/** Sposta un file (es. il documento appena creato) dentro la cartella indicata. */
export async function moveFileToFolder(
  auth: OAuth2Client,
  fileId: string,
  folderId: string,
): Promise<void> {
  const drive = google.drive({ version: "v3", auth });
  const { data } = await drive.files.get({
    fileId,
    fields: "parents",
  });
  const previousParents = (data.parents ?? []).join(",");
  await drive.files.update({
    fileId,
    addParents: folderId,
    removeParents: previousParents || undefined,
    fields: "id, parents",
  });
}

/** Rende il file leggibile da chiunque abbia il link e restituisce l'URL. */
export async function makeShareableAndGetLink(
  auth: OAuth2Client,
  fileId: string,
): Promise<string> {
  const drive = google.drive({ version: "v3", auth });
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
  const { data } = await drive.files.get({
    fileId,
    fields: "webViewLink",
  });
  if (!data.webViewLink) {
    throw new Error("Google Drive non ha restituito il link del documento");
  }
  return data.webViewLink;
}
