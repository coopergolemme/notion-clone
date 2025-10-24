import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { createPage } from "../utils/createPage";
import {
  Button,
  Card,
  Badge,
  Group,
  Stack,
  SimpleGrid,
  Text,
  Title,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { DataTable } from "mantine-datatable";
import "@mantine/core/styles.layer.css";
import "mantine-datatable/styles.layer.css";
import { IconTrash } from "@tabler/icons-react";

type Row = {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  created_at?: string;
};

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const loc = useLocation();
  const nav = useNavigate();
  const params = new URLSearchParams(loc.search);
  const view = params.get("view") || "Gallery";
  const tagsParam = params.get("tags") || "";
  const activeTags = useMemo(
    () => (tagsParam ? tagsParam.split(",").filter(Boolean) : []),
    [tagsParam]
  );

  async function load() {
    const { data } = await api.get<Row[]>("/pages");
    setRows(data);
  }
  const deletePage = async (id: string) => {
    try {
      await api.delete(`/pages/${id}`);
      setRows((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete page", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function createNewPage() {
    try {
      const id = await createPage();
      nav(`/page/${id}`);
    } catch (err) {
      console.error("Failed to create page", err);
    }
  }

  const filtered = useMemo(() => {
    if (!activeTags.length) return rows;
    return rows.filter((r) =>
      (r.tags || []).some((t) => activeTags.includes(t))
    );
  }, [rows, activeTags]);

  return (
    <Stack>
      <Title order={3}>Your Pages</Title>
      {view === "table" ? (
        <DataTable
          withTableBorder
          withColumnBorders
          striped
          highlightOnHover
          records={filtered}
          columns={[
            {
              accessor: "title",
              title: "Title",
              render: (r) => <a href={`/page/${r.id}`}>{r.title}</a>,
            },
            { accessor: "snippet", title: "Snippet" },
            {
              accessor: "tags",
              title: "Tags",
              render: (r) => (
                <Group gap="xs">
                  {(r.tags || []).map((t) => (
                    <Badge
                      key={t}
                      variant="light">
                      {t}
                    </Badge>
                  ))}
                </Group>
              ),
            },
          ]}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {filtered.map((r) => (
            <Card
              key={r.id}
              withBorder
              shadow="sm">
              <Stack gap={6}>
                <Group justify="space-between">
                  <a href={`/page/${r.id}`}>
                    <Text fw={600}>{r.title}</Text>
                  </a>
                  <Tooltip label="Delete Page">
                    <ActionIcon
                      size="md"
                      onClick={() => deletePage(r.id)}>
                      <IconTrash />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Text
                  size="sm"
                  c="dimmed">
                  <span style={{ whiteSpace: "pre-wrap" }}>
                    {r.snippet.replace(/(<([^>]+)>)/gi, "")}
                  </span>
                </Text>
                <Group gap="xs">
                  {(r.tags || []).map((t) => (
                    <Badge
                      key={t}
                      variant="light">
                      {t}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
