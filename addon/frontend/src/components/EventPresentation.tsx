import { Badge, Group, Text } from "@mantine/core";
import { IconClock, IconMapPin } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import type { EventTypeDef, TeamEvent } from "../types";
import { EventTypeIcon } from "./EventTypeIcon";

export function DateTile({
  date,
  highlighted = false,
}: {
  date: string;
  highlighted?: boolean;
}) {
  const value = new Date(`${date}T12:00:00`);
  return (
    <div
      className={`app-date-tile${highlighted ? " is-highlighted" : ""}`}
      aria-label={new Intl.DateTimeFormat("it-IT", {
        dateStyle: "full",
      }).format(value)}
    >
      <span>
        {new Intl.DateTimeFormat("it-IT", { month: "short" })
          .format(value)
          .replace(".", "")}
      </span>
      <strong>{value.getDate()}</strong>
    </div>
  );
}

export function EventStatusBadge({ status }: { status: TeamEvent["status"] }) {
  return (
    <Badge
      color={
        status === "cancelled"
          ? "red"
          : status === "modified"
            ? "orange"
            : "green"
      }
      size="sm"
      variant="light"
    >
      {status === "cancelled"
        ? "Annullato"
        : status === "modified"
          ? "Modificato"
          : "Programmato"}
    </Badge>
  );
}

/** Presentazione condivisa da agenda e panoramica; nessuna logica di modifica. */
export default function EventSummary({
  event,
  type,
  highlighted = false,
}: {
  event: TeamEvent;
  type?: EventTypeDef;
  highlighted?: boolean;
}) {
  return (
    <Link className="app-event-summary" to={`/events/${event.id}`}>
      <DateTile date={event.date} highlighted={highlighted} />
      <div className="app-event-content">
        {event.opponent && (
          <span className="app-event-type">
            <EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} size={15} />
            <span>{type?.label ?? event.type}</span>
          </span>
        )}
        <Group gap={6} wrap="nowrap" mt={event.opponent ? 4 : 0}>
          {!event.opponent && (
            <EventTypeIcon name={type?.icon ?? "IconCalendarEvent"} size={17} />
          )}
          <Text fw={600} size="sm" lineClamp={2}>
            {event.opponent
              ? `vs ${event.opponent}`
              : (type?.label ?? event.type)}
          </Text>
        </Group>
        {event.status !== "scheduled" && (
          <Group mt={5}>
            <EventStatusBadge status={event.status} />
          </Group>
        )}
        <div className="app-event-meta">
          {event.startTime && (
            <span>
              <IconClock size={13} />
              {event.startTime}
              {event.endTime ? ` – ${event.endTime}` : ""}
            </span>
          )}
          {event.location && (
            <span>
              <IconMapPin size={13} />
              {event.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
