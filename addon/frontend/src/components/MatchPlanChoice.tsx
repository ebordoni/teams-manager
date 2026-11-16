import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { MatchPlan } from "../types";
import { formatDatesInText } from "../utils/date";

export default function MatchPlanChoice({
  plan,
  selected,
  onSelect,
  onDelete,
}: {
  plan: MatchPlan;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      withBorder
      padding="md"
      className={`match-plan-choice${selected ? " is-selected" : ""}`}
    >
      <Group gap="xs" wrap="nowrap">
        <UnstyledButton
          onClick={onSelect}
          aria-pressed={selected}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Text size="sm" fw={600}>
            {formatDatesInText(plan.name)}
          </Text>
          <Group gap={5} mt={7}>
            <Badge
              size="xs"
              color={
                plan.source === "ai"
                  ? "green"
                  : plan.source === "manual"
                    ? "brand"
                    : "orange"
              }
            >
              {plan.source === "ai"
                ? "AI"
                : plan.source === "manual"
                  ? "Manuale"
                  : "Automatico"}
            </Badge>
            <Badge
              size="xs"
              color={plan.status === "confirmed" ? "green" : "gray"}
            >
              {plan.status === "confirmed" ? "Confermato" : "Bozza"}
            </Badge>
          </Group>
        </UnstyledButton>
        <ActionIcon
          color="red"
          variant="subtle"
          onClick={onDelete}
          aria-label={`Elimina piano ${plan.name}`}
        >
          <IconTrash size={17} />
        </ActionIcon>
      </Group>
    </Card>
  );
}
