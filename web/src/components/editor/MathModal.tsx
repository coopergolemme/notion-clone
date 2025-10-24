import { useMemo, useState } from "react";
import { modals } from "@mantine/modals";
import { Button, Group, Paper, Stack, Text, Textarea } from "@mantine/core";
import katex from "katex";

type MathModalOptions = {
  initialValue?: string;
  displayMode: boolean;
  onSubmit: (latex: string) => void;
  title?: string;
  submitLabel?: string;
};

type MathModalContentProps = {
  initialValue: string;
  displayMode: boolean;
  submitLabel: string;
  onSubmit: (latex: string) => void;
  onCancel: () => void;
};

function MathModalContent({
  initialValue,
  displayMode,
  submitLabel,
  onSubmit,
  onCancel,
}: MathModalContentProps) {
  const [value, setValue] = useState(initialValue);

  const { html, error } = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return { html: "", error: "" };
    }

    try {
      return {
        html: katex.renderToString(trimmed, {
          displayMode,
          throwOnError: false,
        }),
        error: "",
      };
    } catch (err) {
      return { html: "", error: (err as Error).message };
    }
  }, [value, displayMode]);

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={500} mb={4}>
          LaTeX expression
        </Text>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          minRows={5}
          autosize
          data-autofocus
          placeholder={displayMode ? "\\int_a^b f(x) dx" : "E = mc^2"}
          styles={{ textarea: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
        />
      </div>
      <div>
        <Text size="sm" fw={500} mb={4}>
          Preview
        </Text>
        <Paper
          withBorder
          radius="md"
          p="md"
          style={{ minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <Text size="sm" c="dimmed">
              Start typing to see a preview.
            </Text>
          )}
        </Paper>
      </div>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSubmit(value.trim());
          }}
          disabled={!value.trim()}
        >
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}

export function openMathModal({
  initialValue = "",
  displayMode,
  onSubmit,
  title,
  submitLabel = "Insert",
}: MathModalOptions) {
  const id = modals.open({
    title: title ?? (displayMode ? "Insert block math" : "Insert inline math"),
    children: (
      <MathModalContent
        initialValue={initialValue}
        displayMode={displayMode}
        submitLabel={submitLabel}
        onSubmit={(latex) => {
          onSubmit(latex);
          modals.close(id);
        }}
        onCancel={() => modals.close(id)}
      />
    ),
    centered: true,
    size: "lg",
    withinPortal: true,
  });

  return id;
}

export default openMathModal;
