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
 * Sostituisce il solo contenuto del body, mantenendo lo stesso Google Doc e
 * quindi lo stesso link condiviso. Gli eventuali header/footer del documento
 * non vengono toccati.
 */
export async function replaceStyledDocument(
  auth: OAuth2Client,
  documentId: string,
  builder: DocumentBuilder,
): Promise<void> {
  const docs = google.docs({ version: "v1", auth });
  const document = await docs.documents.get({ documentId });
  const content = document.data.body?.content ?? [];
  const endIndex = content.at(-1)?.endIndex ?? 1;
  const requests = [
    ...(endIndex > 1
      ? [{ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } }]
      : []),
    ...builder.build(),
  ];

  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }
}
