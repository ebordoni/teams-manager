import { docs_v1 } from "googleapis";

type TextStyle = docs_v1.Schema$TextStyle;
type ParagraphStyle = docs_v1.Schema$ParagraphStyle;

interface TextSegment {
  text: string;
  textStyle?: TextStyle;
  paragraphStyle?: ParagraphStyle;
}

interface StyleDefinition {
  textStyle?: TextStyle;
  paragraphStyle?: ParagraphStyle;
}

export class DocumentBuilder {
  private segments: TextSegment[] = [];

  /**
   * Aggiunge testo al documento.
   */
  addText(text: string, style?: StyleDefinition): this {
    this.segments.push({
      text,
      textStyle: style?.textStyle,
      paragraphStyle: style?.paragraphStyle,
    });

    return this;
  }

  /**
   * Aggiunge un paragrafo terminato da newline.
   */
  addParagraph(text: string, style?: StyleDefinition): this {
    this.addText(`${text}\n`, style);
    return this;
  }

  /**
   * Aggiunge una riga vuota.
   */
  addEmptyLine(): this {
    this.addText("\n");
    return this;
  }

  /**
   * Costruisce il testo completo e le relative richieste Google Docs.
   */
  build(): docs_v1.Schema$Request[] {
    const requests: docs_v1.Schema$Request[] = [];

    const bodyText = this.segments.map((segment) => segment.text).join("");

    if (!bodyText) {
      return requests;
    }

    /*
     * Prima inseriamo tutto il testo.
     */
    requests.push({
      insertText: {
        location: {
          index: 1,
        },
        text: bodyText,
      },
    });

    /*
     * Ora calcoliamo gli intervalli e applichiamo
     * la formattazione.
     */
    let currentIndex = 1;

    for (const segment of this.segments) {
      const startIndex = currentIndex;
      const endIndex = currentIndex + segment.text.length;

      /*
       * Formattazione del testo:
       * font, dimensione, grassetto, corsivo, ecc.
       */
      if (segment.textStyle) {
        const fields = Object.keys(segment.textStyle).join(",");

        if (fields) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex,
                endIndex,
              },
              textStyle: segment.textStyle,
              fields,
            },
          });
        }
      }

      /*
       * Formattazione del paragrafo:
       * allineamento, spaziatura, ecc.
       */
      if (segment.paragraphStyle) {
        const fields = Object.keys(segment.paragraphStyle).join(",");

        if (fields) {
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex,
                endIndex,
              },
              paragraphStyle: segment.paragraphStyle,
              fields,
            },
          });
        }
      }

      currentIndex = endIndex;
    }

    return requests;
  }

  /**
   * Restituisce il testo completo.
   * Utile per debug o logging.
   */
  getText(): string {
    return this.segments.map((segment) => segment.text).join("");
  }
}
