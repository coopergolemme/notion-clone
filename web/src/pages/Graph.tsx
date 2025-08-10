import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Network } from "vis-network";
import {
  Group,
  ActionIcon,
  Paper,
  Stack,
  Tooltip,
  Box,
  Text,
} from "@mantine/core";
import {
  IconZoomIn,
  IconZoomOut,
  IconArrowsMaximize,
  IconPlayerPlay,
  IconPlayerPause,
} from "@tabler/icons-react";

interface NodeInfo {
  id: string;
  label: string;
  title: string;
  x: number;
  y: number;
}

export default function Graph() {
  const el = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const [physics, setPhysics] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<NodeInfo | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let network: Network | null = null;
    async function load() {
      const { data } = await api.get("/graph");
      console.log("Graph data:", data);
      if (!el.current) return;

      network = new Network(el.current, data, {
        nodes: {
          shape: "dot",
          size: 12,
          font: { size: 14 },
          chosen: { node: true },
        },
        edges: {
          arrows: { to: { enabled: true, scaleFactor: 0.6 } },
          color: "#bbb",
        },
        physics: { stabilization: true },
        interaction: { hover: true, tooltipDelay: 200 },
      });

      networkRef.current = network;

      network.on("doubleClick", (params: any) => {
        const id = params?.nodes?.[0];
        if (id) window.location.href = `/page/${id}`;
      });

      network.on("hoverNode", (params: any) => {
        const nodeId = params.node;
        const node = data.nodes.find((n: any) => n.id === nodeId);
        if (node) {
          const canvasPosition = network.canvasToDOM(params.pointer.canvas);
          setMousePosition({
            x: canvasPosition.x,
            y: canvasPosition.y,
          });
          setHoveredNode({
            id: node.id,
            label: node.title || node.title || "Untitled",
            title: node.label || "",
            x: canvasPosition.x,
            y: canvasPosition.y,
          });
        }
      });

      network.on("blurNode", () => {
        setHoveredNode(null);
      });

      network.on("dragStart", () => {
        setHoveredNode(null);
      });
    }

    load();
    return () => {
      if (network) network.destroy();
    };
  }, []);

  function zoom(f: number) {
    const n = networkRef.current;
    if (!n) return;
    const scale = n.getScale() * f;
    n.moveTo({ scale });
  }

  function fit() {
    networkRef.current?.fit();
  }

  function togglePhysics() {
    const n = networkRef.current;
    if (!n) return;
    const next = !physics;
    n.setOptions({ physics: next });
    setPhysics(next);
  }

  return (
    <Stack style={{ position: "relative" }}>
      <Group gap="xs">
        <ActionIcon
          variant="light"
          onClick={() => zoom(1.2)}>
          <IconZoomIn size={16} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          onClick={() => zoom(0.8)}>
          <IconZoomOut size={16} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          onClick={fit}>
          <IconArrowsMaximize size={16} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          onClick={togglePhysics}>
          {physics ? (
            <IconPlayerPause size={16} />
          ) : (
            <IconPlayerPlay size={16} />
          )}
        </ActionIcon>
      </Group>

      <Paper
        withBorder
        radius="md"
        style={{ height: "70vh", position: "relative" }}>
        <div
          ref={el}
          style={{ height: "100%" }}
        />

        {hoveredNode && (
          <Paper
            shadow="md"
            p="md"
            style={{
              position: "absolute",
              left: mousePosition.x + 10,
              top: mousePosition.y - 10,
              maxWidth: 300,
              zIndex: 1000,
              pointerEvents: "none",
              backgroundColor: "var(--mantine-color-body)",
              border: "1px solid var(--mantine-color-gray-3)",
            }}>
            <Stack gap="xs">
              <Text
                fw={500}
                size="sm"
                lineClamp={1}>
                {hoveredNode.title}
              </Text>
              {hoveredNode.label && (
                <Text
                  size="xs"
                  c="dimmed"
                  lineClamp={3}>
                  {hoveredNode.label.replace(/<[^>]*>/g, "").substring(0, 150)}
                  {hoveredNode.label.length > 150 ? "..." : ""}
                </Text>
              )}
              <Text
                size="xs"
                c="dimmed">
                ID: {hoveredNode.id}
              </Text>
            </Stack>
          </Paper>
        )}
      </Paper>
    </Stack>
  );
}
