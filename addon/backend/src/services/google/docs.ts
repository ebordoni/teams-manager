import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { DocumentBuilder } from "./DocumentBuilder";

/** Crea un Google Doc applicando testo e stili prodotti dal builder. */
export async function createStyledDocument(
  auth: OAuth2Client,
  title: string,
  builder: DocumentBuilder,
): Promise<string> {
  const docs = google.docs({ version: "v1", auth });
  const created = await docs.documents.create({ requestBody: { title } });
  const documentId = created.data.documentId;
  if (!documentId) {
    throw new Error("Google Docs non ha restituito l'id del documento creato");
  }

  const requests = builder.build();
  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }

  return documentId;
}

/**
 * Sostituisce nel documento indicato tutti i placeholder `{{CHIAVE}}` con i
 * valori forniti (usato dopo aver copiato un documento-template da Drive).
 */
export async function replacePlaceholders(
  auth: OAuth2Client,
  documentId: string,
  replacements: Record<string, string>,
): Promise<void> {
  const docs = google.docs({ version: "v1", auth });

  const requests = Object.entries(replacements).map(([key, value]) => ({
    replaceAllText: {
      containsText: { text: `{{${key}}}`, matchCase: true },
      replaceText: value,
    },
  }));

  if (requests.length === 0) return;

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests },
  });
}
