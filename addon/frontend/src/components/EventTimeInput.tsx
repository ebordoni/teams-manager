import { Group, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

interface EventTimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Tastiera numerica e passaggio automatico dalle ore ai minuti. */
export default function EventTimeInput({ label, value, onChange }: EventTimeInputProps) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const minutesRef = useRef<HTMLInputElement>(null);
  const lastEmittedValue = useRef<string | null>(null);

  useEffect(() => {
    if (value === lastEmittedValue.current) {
      lastEmittedValue.current = null;
      return;
    }
    const match = value.match(/^(\d{2}):(\d{2})$/);
    setHours(match?.[1] ?? "");
    setMinutes(match?.[2] ?? "");
  }, [value]);

  const emit = (nextValue: string) => {
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
  };

  const publish = (nextHours: string, nextMinutes: string) => {
    if (nextHours.length === 2 && nextMinutes.length === 2) {
      emit(`${nextHours}:${nextMinutes}`);
    } else {
      emit("");
    }
  };
  const digits = (input: string) => input.replace(/\D/g, "").slice(0, 2);

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>{label}</Text>
      <Group gap={4} wrap="nowrap">
        <TextInput
          aria-label={`${label}, ore`}
          placeholder="HH"
          value={hours}
          onChange={(event) => {
            const next = digits(event.currentTarget.value);
            if (next.length === 2 && Number(next) > 23) return;
            setHours(next);
            if (!next) {
              setMinutes("");
              emit("");
              return;
            }
            publish(next, minutes);
            if (next.length === 2) minutesRef.current?.focus();
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          w={64}
        />
        <Text fw={700}>:</Text>
        <TextInput
          ref={minutesRef}
          aria-label={`${label}, minuti`}
          placeholder="MM"
          value={minutes}
          onChange={(event) => {
            const next = digits(event.currentTarget.value);
            if (next.length === 2 && Number(next) > 59) return;
            setMinutes(next);
            publish(hours, next);
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          w={64}
        />
      </Group>
    </Stack>
  );
}
