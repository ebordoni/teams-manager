import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export default function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <Group className="app-page-header" justify="space-between" align="flex-end" gap="md" wrap="wrap">
      <Stack gap={4} style={{ minWidth: 0 }}>
        {eyebrow && <Text className="app-page-eyebrow">{eyebrow}</Text>}
        <Title order={2} className="app-page-title">{title}</Title>
        {description && <Text c="dimmed" size="sm">{description}</Text>}
      </Stack>
      {action && <Group gap="xs" wrap="wrap">{action}</Group>}
    </Group>
  );
}
