import { docs_v1 } from "googleapis";

type StyleDefinition = {
  textStyle?: docs_v1.Schema$TextStyle;
  paragraphStyle?: docs_v1.Schema$ParagraphStyle;
};

export const documentStyles: Record<string, StyleDefinition> = {
  title: {
    textStyle: {
      weightedFontFamily: {
        fontFamily: "Montserrat",
      },
      fontSize: {
        magnitude: 20,
        unit: "PT",
      },
      bold: true,
    },
    paragraphStyle: {
      alignment: "CENTER",
      spaceBelow: {
        magnitude: 8,
        unit: "PT",
      },
    },
  },

  subtitle: {
    textStyle: {
      weightedFontFamily: {
        fontFamily: "Montserrat",
      },
      fontSize: {
        magnitude: 14,
        unit: "PT",
      },
      bold: true,
    },
    paragraphStyle: {
      alignment: "CENTER",
      spaceBelow: {
        magnitude: 16,
        unit: "PT",
      },
    },
  },

  date: {
    textStyle: {
      weightedFontFamily: {
        fontFamily: "Montserrat",
      },
      fontSize: {
        magnitude: 16,
        unit: "PT",
      },
      bold: true,
    },
    paragraphStyle: {
      spaceAbove: {
        magnitude: 10,
        unit: "PT",
      },
      spaceBelow: {
        magnitude: 4,
        unit: "PT",
      },
    },
  },

  event: {
    textStyle: {
      weightedFontFamily: {
        fontFamily: "Montserrat",
      },
      fontSize: {
        magnitude: 13,
        unit: "PT",
      },
      bold: true,
    },
    paragraphStyle: {
      spaceBelow: {
        magnitude: 6,
        unit: "PT",
      },
    },
  },

  match: {
    textStyle: {
      weightedFontFamily: {
        fontFamily: "Montserrat",
      },
      fontSize: {
        magnitude: 12,
        unit: "PT",
      },
      bold: true,
    },
    paragraphStyle: {
      spaceBelow: {
        magnitude: 6,
        unit: "PT",
      },
    },
  },

  normal: {
    textStyle: {
      weightedFontFamily: {
        fontFamily: "Montserrat",
      },
      fontSize: {
        magnitude: 11,
        unit: "PT",
      },
    },
  },

  note: {
    textStyle: {
      weightedFontFamily: {
        fontFamily: "Montserrat",
      },
      fontSize: {
        magnitude: 10,
        unit: "PT",
      },
      italic: true,
    },
  },
};
