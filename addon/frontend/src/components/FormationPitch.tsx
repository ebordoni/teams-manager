import { Avatar, Box, Text, UnstyledButton } from "@mantine/core";
import type { Player } from "../types";

export const formationSlots = [
  ["portiere", "Portiere", "50%", "88%"],
  ["difensoreSinistro", "Difensore sinistro", "28%", "70%"],
  ["difensoreDestro", "Difensore destro", "72%", "70%"],
  ["centrale", "Centrocampista", "50%", "51%"],
  ["fasciaSinistra", "Fascia sinistra", "20%", "34%"],
  ["fasciaDestra", "Fascia destra", "80%", "34%"],
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
export default function FormationPitch({
  assignments,
  players,
  onSlotClick,
  ariaLabel = "Formazione 2-3-1",
}: FormationPitchProps) {
  return (
    <Box aria-label={ariaLabel} className="formation-pitch">
      <Box
        style={{
          position: "absolute",
          inset: "50% 0 auto",
          borderTop: "2px solid rgba(255,255,255,.82)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          width: 112,
          height: 112,
          border: "2px solid rgba(255,255,255,.82)",
          borderRadius: "50%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          width: "54%",
          height: 66,
          border: "2px solid rgba(255,255,255,.82)",
          borderBottom: 0,
          bottom: 0,
          left: "23%",
        }}
      />
      <Box
        style={{
          position: "absolute",
          width: "54%",
          height: 66,
          border: "2px solid rgba(255,255,255,.82)",
          borderTop: 0,
          top: 0,
          left: "23%",
        }}
      />
      {formationSlots.map(([key, label, left, top]) => {
        const player = players.find((item) => item.id === assignments[key]);
        const content = (
          <>
            <Avatar
              src={player?.photo}
              alt={player ? `Foto di ${player.name}` : undefined}
              radius="xl"
              className={`formation-player${!player ? " is-empty" : ""}`}
            >
              {player
                ? (player.jerseyNumber ?? player.name.slice(0, 1).toUpperCase())
                : "+"}
            </Avatar>
            <Text className="formation-position" c="white" lineClamp={2}>
              {player?.name ?? label}
            </Text>
          </>
        );
        const style = {
          position: "absolute" as const,
          left,
          top,
          transform: "translate(-50%, -50%)",
          width: 112,
          textAlign: "center" as const,
          zIndex: 1,
        };
        return onSlotClick ? (
          <UnstyledButton
            key={key}
            className="formation-slot"
            onClick={() => onSlotClick(key)}
            aria-label={`${label}: ${player?.name ?? "non assegnato"}`}
            style={style}
          >
            {content}
          </UnstyledButton>
        ) : (
          <Box key={key} style={style}>
            {content}
          </Box>
        );
      })}
    </Box>
  );
}
