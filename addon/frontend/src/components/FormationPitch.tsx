import { Box, Text, UnstyledButton } from "@mantine/core";
import type { Player } from "../types";

export const formationSlots = [
  ["portiere", "Portiere", "50%", "88%"], ["difensoreSinistro", "Difensore sinistro", "28%", "70%"],
  ["difensoreDestro", "Difensore destro", "72%", "70%"], ["centrale", "Centrocampista", "50%", "51%"],
  ["fasciaSinistra", "Fascia sinistra", "20%", "34%"], ["fasciaDestra", "Fascia destra", "80%", "34%"],
  ["attaccante", "Attaccante", "50%", "15%"],
] as const;

export type FormationSlot = (typeof formationSlots)[number][0];
export type FormationAssignments = Record<FormationSlot, number | null>;

interface FormationPitchProps {
  assignments: FormationAssignments;
  players: Player[];
  onSlotClick?: (slot: FormationSlot) => void;
  ariaLabel?: string;
}

/** Campo 2-3-1 condiviso da Formazioni e Piano partita. */
export default function FormationPitch({ assignments, players, onSlotClick, ariaLabel = "Formazione 2-3-1" }: FormationPitchProps) {
  return <Box aria-label={ariaLabel} style={{ minHeight: 430, position: "relative", overflow: "hidden", borderRadius: "var(--mantine-radius-md)", border: "2px solid var(--mantine-color-green-8)", background: "linear-gradient(90deg, #32844c 0%, #3e9b5b 50%, #32844c 100%)" }}>
    <Box style={{ position: "absolute", inset: "50% 0 auto", borderTop: "2px solid rgba(255,255,255,.82)" }} />
    <Box style={{ position: "absolute", width: 112, height: 112, border: "2px solid rgba(255,255,255,.82)", borderRadius: "50%", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
    <Box style={{ position: "absolute", width: "54%", height: 66, border: "2px solid rgba(255,255,255,.82)", borderBottom: 0, bottom: 0, left: "23%" }} />
    <Box style={{ position: "absolute", width: "54%", height: 66, border: "2px solid rgba(255,255,255,.82)", borderTop: 0, top: 0, left: "23%" }} />
    {formationSlots.map(([key, label, left, top]) => {
      const player = players.find((item) => item.id === assignments[key]);
      const content = <><Box style={{ width: 38, height: 38, margin: "0 auto 4px", borderRadius: "50%", display: "grid", placeItems: "center", background: player ? "var(--mantine-color-blue-7)" : "rgba(255,255,255,.22)", border: "2px solid white", color: "white", fontWeight: 700 }}>{player ? player.name.slice(0, 1).toUpperCase() : "+"}</Box><Text size="xs" c="white" fw={700} lh={1.1}>{player?.name ?? label}</Text></>;
      const style = { position: "absolute" as const, left, top, transform: "translate(-50%, -50%)", width: 112, textAlign: "center" as const, zIndex: 1 };
      return onSlotClick
        ? <UnstyledButton key={key} onClick={() => onSlotClick(key)} aria-label={`${label}: ${player?.name ?? "non assegnato"}`} style={style}>{content}</UnstyledButton>
        : <Box key={key} style={style}>{content}</Box>;
    })}
  </Box>;
}
