import { Group, Select, Text, type SelectProps } from "@mantine/core";
import {
  IconAward,
  IconBallBasketball,
  IconBallFootball,
  IconBell,
  IconBottle,
  IconBuildingStadium,
  IconBus,
  IconCalendarEvent,
  IconCamera,
  IconCar,
  IconClipboardCheck,
  IconClock,
  IconCloudRain,
  IconFirstAidKit,
  IconFlag,
  IconHeartHandshake,
  IconHome,
  IconMapPin,
  IconMedal,
  IconMessageCircle,
  IconMoodSmile,
  IconPennant,
  IconRun,
  IconSchool,
  IconShirtSport,
  IconSpeakerphone,
  IconStethoscope,
  IconSun,
  IconSwords,
  IconTargetArrow,
  IconTrophy,
  IconUsersGroup,
  IconVideo,
} from "@tabler/icons-react";

const icons = {
  IconBallFootball,
  IconTrophy,
  IconMedal,
  IconAward,
  IconFlag,
  IconPennant,
  IconBuildingStadium,
  IconShirtSport,
  IconTargetArrow,
  IconRun,
  IconSwords,
  IconCalendarEvent,
  IconClock,
  IconClipboardCheck,
  IconUsersGroup,
  IconHeartHandshake,
  IconMessageCircle,
  IconBell,
  IconSpeakerphone,
  IconMapPin,
  IconBus,
  IconCar,
  IconHome,
  IconSchool,
  IconSun,
  IconCloudRain,
  IconFirstAidKit,
  IconStethoscope,
  IconBottle,
  IconMoodSmile,
  IconCamera,
  IconVideo,
  IconBallBasketball,
};

const iconCatalog: Array<[keyof typeof icons, string]> = [
  ["IconBallFootball", "Pallone da calcio"],
  ["IconTrophy", "Trofeo"],
  ["IconMedal", "Medaglia"],
  ["IconAward", "Premio"],
  ["IconFlag", "Bandierina"],
  ["IconPennant", "Gagliardetto"],
  ["IconBuildingStadium", "Stadio"],
  ["IconShirtSport", "Maglia sportiva"],
  ["IconTargetArrow", "Obiettivo"],
  ["IconRun", "Corsa / allenamento"],
  ["IconSwords", "Sfida"],
  ["IconCalendarEvent", "Calendario"],
  ["IconClock", "Orario"],
  ["IconClipboardCheck", "Verifica"],
  ["IconUsersGroup", "Squadra"],
  ["IconHeartHandshake", "Incontro"],
  ["IconMessageCircle", "Comunicazione"],
  ["IconBell", "Promemoria"],
  ["IconSpeakerphone", "Avviso"],
  ["IconMapPin", "Luogo"],
  ["IconBus", "Trasferta in bus"],
  ["IconCar", "Trasferta in auto"],
  ["IconHome", "Casa"],
  ["IconSchool", "Scuola"],
  ["IconSun", "Bel tempo"],
  ["IconCloudRain", "Pioggia"],
  ["IconFirstAidKit", "Pronto soccorso"],
  ["IconStethoscope", "Visita medica"],
  ["IconBottle", "Pausa acqua"],
  ["IconMoodSmile", "Festa"],
  ["IconCamera", "Foto"],
  ["IconVideo", "Video"],
  ["IconBallBasketball", "Altro sport"],
];

// Le opzioni passano da una Map: Mantine 9 lancia un errore di rendering se due
// voci condividono lo stesso `value`, quindi i duplicati vanno collassati qui.
export const eventTypeIconOptions = [...new Map(iconCatalog)].map(
  ([value, label]) => ({ value, label }),
);

export function EventTypeIcon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name as keyof typeof icons];
  return Icon ? (
    <Icon size={size} aria-hidden="true" />
  ) : (
    <span aria-hidden="true">{name}</span>
  );
}

type EventTypeIconPickerProps = Omit<
  SelectProps,
  "data" | "renderOption" | "leftSection"
>;

/** Select ricercabile con anteprima dell'icona nel campo e in ogni opzione. */
export function EventTypeIconPicker({
  value,
  ...props
}: EventTypeIconPickerProps) {
  return (
    <Select
      {...props}
      value={value}
      data={eventTypeIconOptions}
      searchable
      limit={12}
      nothingFoundMessage="Nessuna icona trovata"
      leftSection={value ? <EventTypeIcon name={value} /> : undefined}
      renderOption={({ option }) => (
        <Group gap="sm" wrap="nowrap">
          <EventTypeIcon name={option.value} />
          <Text size="sm">{option.label}</Text>
        </Group>
      )}
    />
  );
}
