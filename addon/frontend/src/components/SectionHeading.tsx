import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export default function SectionHeading({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Group
      justify="space-between"
      align="center"
      wrap="wrap"
      gap="sm"
      className="app-section-heading"
    >
      <Group gap="sm" wrap="nowrap">
        {icon && <span className="app-section-icon">{icon}</span>}
        <Stack gap={3}>
          <Title order={2} fz="md">
            {title}
          </Title>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
      </Group>
      {action}
    </Group>
  );
}
