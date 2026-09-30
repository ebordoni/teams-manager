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
  const endIndex = Math.max(
    1,
    ...content.map((element) => element.endIndex ?? 1),
  );

  // La cancellazione e il nuovo inserimento restano volutamente in due
  // richieste API. In questo modo gli indici del builder vengono calcolati
  // sempre sul body ormai vuoto, anche per documenti svuotati manualmente.
  if (endIndex > 1) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            deleteContentRange: {
              range: { startIndex: 1, endIndex: endIndex - 1 },
            },
          },
        ],
      },
    });
  }

  const requests = builder.build();
  if (requests.length === 0) return;
  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
}
