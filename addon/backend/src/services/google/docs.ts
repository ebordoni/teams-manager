import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

/** Crea un nuovo Google Doc con il titolo dato e vi inserisce il testo fornito. */
export async function createDocumentWithText(
  auth: OAuth2Client,
  title: string,
  bodyText: string,
): Promise<string> {
  const docs = google.docs({ version: "v1", auth });

  const created = await docs.documents.create({ requestBody: { title } });
  const documentId = created.data.documentId;
  if (!documentId) {
    throw new Error("Google Docs non ha restituito l'id del documento creato");
  }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: bodyText,
          },
        },
      ],
    },
  });

  return documentId;
}
