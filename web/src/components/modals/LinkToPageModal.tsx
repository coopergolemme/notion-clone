import { useEffect, useMemo, useState } from "react";
import { Box, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { ContextModalProps } from "@mantine/modals";

type PageSummary = { id: string; title: string };

type InnerProps = {
  pages: PageSummary[];
  onSelect: (title: string) => void;
  onCancel: () => void;
};

export default function LinkToPageModal({
  context,
  id,
  innerProps,
}: ContextModalProps<InnerProps>) {
  const { pages, onSelect, onCancel } = innerProps;
  const [query, setQuery] = useState("");
  const [manualTitle, setManualTitle] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages.slice(0, 10);
    return pages.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 10);
  }, [pages, query]);

  useEffect(() => {
    if (query && !filtered.length) {
      setManualTitle(query);
    }
  }, [query, filtered.length]);

  const close = () => context.closeModal(id);

  const handleSelect = (title: string) => {
    onSelect(title);
    close();
  };

  const handleSubmit = () => {
    const trimmed = manualTitle.trim();
    if (trimmed) {
      handleSelect(trimmed);
    }
  };

  return (
    <Stack>
      <TextInput
        label="Search pages"
        placeholder="Type to filter…"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter" && filtered.length === 1) {
            event.preventDefault();
            handleSelect(filtered[0].title);
          }
        }}
      />

      <Box>
        {filtered.length === 0 ? (
          <Text
            size="sm"
            c="dimmed">
            No matching pages. Use the custom title below.
          </Text>
        ) : (
          <Stack gap={6}>
            {filtered.map((page, index) => (
              <Button
                key={page.id ?? `${page.title}-${index}`}
                variant="subtle"
                fullWidth
                justify="flex-start"
                onClick={() => handleSelect(page.title)}>
                {page.title}
              </Button>
            ))}
          </Stack>
        )}
      </Box>

      <Stack gap="xs">
        <TextInput
          label="Custom title"
          placeholder="Enter any page title…"
          value={manualTitle}
          onChange={(event) => setManualTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Group justify="space-between">
          <Button
            variant="default"
            onClick={() => {
              onCancel();
              close();
            }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!manualTitle.trim()}>
            Insert Link
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
