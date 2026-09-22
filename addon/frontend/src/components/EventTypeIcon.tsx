import {
  IconBallFootball,
  IconCalendarEvent,
  IconRun,
  IconSwords,
  IconTrophy,
  IconUsersGroup,
} from "@tabler/icons-react";

const icons = { IconBallFootball, IconCalendarEvent, IconRun, IconSwords, IconTrophy, IconUsersGroup };
export const eventTypeIconOptions = Object.keys(icons).map((value) => ({ value, label: value.replace("Icon", "") }));

export function EventTypeIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons];
  return Icon ? <Icon size={size} /> : <span>{name}</span>;
}
