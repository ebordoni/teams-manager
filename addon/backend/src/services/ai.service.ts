import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { generateObject } from "ai";
import { z } from "zod";
import type { AIProvider, MatchPeriod } from "../types";
import { DEFAULT_AI_MODELS, getAIConfig, getAIKey } from "./ai-config.service";
import { generateFallbackRotation, slotsFor, validateRotation, type RotationRequest } from "./rotation.service";

const AIPlanSchema = z.object({
  periods: z.array(z.object({
    periodNumber: z.number().int().positive(),
    lineup: z.array(z.object({
      slot: z.string(),
      playerRef: z.string(),
      role: z.string(),
    })),
    benchPlayerRefs: z.array(z.string()),
  })),
  explanation: z.string(),
});

const ConnectionSchema = z.object({ ok: z.boolean(), message: z.string() });

interface Candidate { provider: AIProvider; model: string; apiKey: string }
export interface GeneratedRotation {
  periods: MatchPeriod[];
  source: "ai" | "fallback";
  provider: string | null;
  model: string | null;
  warnings: string[];
}

export class AIService {
  private resolveModel(provider: AIProvider, model: string, apiKey: string) {
    switch (provider) {
      case "openai": return createOpenAI({ apiKey })(model);
      case "google": return createGoogleGenerativeAI({ apiKey })(model);
      case "anthropic": return createAnthropic({ apiKey })(model);
      case "groq": return createGroq({ apiKey })(model);
      case "xai": return createXai({ apiKey })(model);
    }
  }

  private candidates(): Candidate[] {
    const settings = getAIConfig();
    return [settings.provider, ...settings.fallbackProviders]
      .flatMap((provider) => {
        const apiKey = getAIKey(provider);
        if (!apiKey) return [];
        return [{
          provider,
          model: provider === settings.provider ? settings.model : DEFAULT_AI_MODELS[provider],
          apiKey,
        }];
      });
  }

  async testConnection(): Promise<{ provider: string; model: string; message: string }> {
    const candidate = this.candidates()[0];
    if (!candidate) throw new Error("Nessuna chiave API configurata per il provider selezionato");
    const { object } = await generateObject({
      model: this.resolveModel(candidate.provider, candidate.model, candidate.apiKey),
      schema: ConnectionSchema,
      prompt: "Rispondi con ok=true e un breve messaggio in italiano per confermare che il modello è disponibile.",
      temperature: 0,
    });
    if (!object.ok) throw new Error(object.message);
    return { provider: candidate.provider, model: candidate.model, message: object.message };
  }

  async generateRotations(request: RotationRequest): Promise<GeneratedRotation> {
    const aliases = new Map(request.players.map((player, index) => [`P${index + 1}`, player.id]));
    const anonymizedPlayers = request.players.map((player, index) => ({ playerRef: `P${index + 1}`, roles: player.roles }));
    const slots = slotsFor(request.playersOnField).map(([slot, role]) => ({ slot, role }));
    const totalSpots = request.periodCount * request.playersOnField;
    const minAppearances = Math.floor(totalSpots / request.players.length);
    const maxAppearances = Math.ceil(totalSpots / request.players.length);
    const basePrompt = `Sei un assistente per un allenatore di calcio giovanile. Crea una formazione completa per ciascun tempo.

VINCOLI OBBLIGATORI:
- usa soltanto i riferimenti giocatore forniti;
- ogni tempo deve contenere esattamente ${request.playersOnField} giocatori diversi;
- assegna esattamente uno slot a ogni giocatore in campo;
- ogni tempo deve avere lo slot portiere;
- fai giocare ogni convocato tra ${minAppearances} e ${maxAppearances} tempi, se compatibile con il vincolo del portiere;
- limita i cambi agli intervalli tra i tempi;
- rispetta i ruoli con modalità ${request.rolePolicy};
- varia le combinazioni tra i tempi quando possibile.

DATI PARTITA:
${JSON.stringify({ periodCount: request.periodCount, minutesPerPeriod: request.minutesPerPeriod, playersOnField: request.playersOnField, slots, players: anonymizedPlayers }, null, 2)}`;

    const failures: string[] = [];
    for (const candidate of this.candidates()) {
      let correction = "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const { object } = await generateObject({
            model: this.resolveModel(candidate.provider, candidate.model, candidate.apiKey),
            schema: AIPlanSchema,
            prompt: `${basePrompt}${correction}`,
            temperature: 0.15,
          });
          const periods: MatchPeriod[] = object.periods.map((period) => ({
            periodNumber: period.periodNumber,
            assignments: period.lineup.map((assignment) => ({
              slot: assignment.slot,
              playerId: aliases.get(assignment.playerRef) ?? -1,
              role: assignment.role,
            })),
            benchPlayerIds: period.benchPlayerRefs.map((ref) => aliases.get(ref) ?? -1),
          }));
          const validation = validateRotation(request, periods);
          if (validation.errors.length === 0) {
            return { periods, source: "ai", provider: candidate.provider, model: candidate.model, warnings: validation.warnings };
          }
          correction = `\n\nLa proposta precedente non era valida. Correggi questi errori:\n- ${validation.errors.join("\n- ")}`;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`${candidate.provider}/${candidate.model}: ${message}`);
          break;
        }
      }
    }

    const periods = generateFallbackRotation(request);
    const validation = validateRotation(request, periods);
    const reason = this.candidates().length === 0
      ? "AI non configurata: applicata la rotazione automatica locale."
      : `Generazione AI non riuscita: applicata la rotazione automatica locale. ${failures.join(" | ")}`;
    return { periods, source: "fallback", provider: null, model: null, warnings: [reason, ...validation.warnings, ...validation.errors] };
  }
}
