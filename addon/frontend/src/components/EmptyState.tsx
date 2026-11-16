import { Stack, Text, ThemeIcon } from "@mantine/core";
import { IconCalendarEvent } from "@tabler/icons-react";
import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  icon = <IconCalendarEvent size={24} stroke={1.5} />,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Stack className="app-empty-state" align="center" gap="sm">
      <ThemeIcon size={52} radius="lg" variant="light" color="gray">
        {icon}
      </ThemeIcon>
      <div>
        <Text fw={600} size="sm" ta="center">
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed" ta="center" mt={4} maw={380}>
            {description}
          </Text>
        )}
      </div>
      {action}
    </Stack>
  );
}
