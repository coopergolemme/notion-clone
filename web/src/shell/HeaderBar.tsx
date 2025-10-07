import { Group, ActionIcon, TextInput, Menu } from "@mantine/core";
import {
  IconMenu2,
  IconLayoutSidebarRight,
  IconSearch,
  IconPlus,
  IconGraph,
  IconHome,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { spotlight } from "@mantine/spotlight";
import { createPage } from "../utils/createPage";

export default function HeaderBar({
  onToggleNav,
  onToggleAside,
}: {
  onToggleNav: () => void;
  onToggleAside: () => void;
}) {
  const nav = useNavigate();
  async function handleCreatePage() {
    try {
      const id = await createPage();
      nav(`/page/${id}`);
    } catch (err) {
      console.error("Failed to create page", err);
    }
  }
  return (
    <Group
      h="100%"
      px="md"
      gap="sm"
      justify="space-between">
      <Group gap="xs">
        <ActionIcon
          variant="subtle"
          onClick={onToggleNav}>
          <IconMenu2 size={18} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          onClick={() => nav("/")}>
          <IconHome size={18} />
        </ActionIcon>
      </Group>
      <TextInput
        placeholder="Search pages…"
        leftSection={<IconSearch size={16} />}
        w={480}
        onFocus={(e) => {
          spotlight.open();
          e.currentTarget.blur();
        }}
        onKeyDown={(e: any) => {
          if (e.key === "Enter") {
            spotlight.open();
            spotlight.setQuery(e.currentTarget.value);
            e.currentTarget.blur();
          }
        }}
      />

      <Group gap="xs">
        <ActionIcon
          variant="subtle"
          onClick={() => nav("/graph")}>
          <IconGraph size={18} />
        </ActionIcon>
        <Menu>
          <Menu.Target>
            <ActionIcon variant="filled">
              <IconPlus size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={handleCreatePage}>New page</Menu.Item>
            <Menu.Item onClick={() => nav("/graph")}>Open graph</Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <ActionIcon
          variant="subtle"
          onClick={onToggleAside}>
          <IconLayoutSidebarRight size={18} />
        </ActionIcon>
      </Group>
    </Group>
  );
}
