import { useEffect, useMemo, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { api } from '../api';
import {
  ActionIcon, Badge, Button, Card, Group, HoverCard, MultiSelect, NumberInput,
  Paper, Stack, Text, TextInput, Title, useMantineColorScheme
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconZoomReset, IconTargetArrow, IconDeviceFloppy, IconPhoto } from '@tabler/icons-react';

type NodeRec = { id: string; label: string; tags: string[]; updated_at: string; word_count: number; backlinks: number };
type EdgeRec = { from: string; to: string; weight: number };

export default function Graph() {
  const container = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const [raw, setRaw] = useState<{ nodes: NodeRec[]; edges: EdgeRec[] }>({ nodes: [], edges: [] });
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [weight, setWeight] = useState<number>(1);
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const { colorScheme } = useMantineColorScheme();

  // hover state
  const [hoverNode, setHoverNode] = useState<NodeRec | null>(null);
  const [hoverXY, setHoverXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  async function load() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (tags.length === 1) params.set('tag', tags[0]); // server supports single tag prefilter
    if (dateRange[0]) params.set('from', dateRange[0]!.toISOString());
    if (dateRange[1]) params.set('to', dateRange[1]!.toISOString());
    const { data } = await api.get(`/graph?${params.toString()}`);
    setRaw(data);
    // collect tags for UI
    const tset = new Set<string>();
    data.nodes.forEach((n: NodeRec) => (n.tags || []).forEach((t) => tset.add(t)));
    setAllTags(Array.from(tset.values()).sort());
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // client filters (multi-tag & min weight)
  const filtered = useMemo(() => {
    const tagFilter = (n: NodeRec) => tags.length === 0 || (n.tags || []).some(t => tags.includes(t));
    const nodes = raw.nodes.filter(tagFilter);
    const nodeSet = new Set(nodes.map(n => n.id));
    const edges = raw.edges.filter(e => e.weight >= weight && nodeSet.has(e.from) && nodeSet.has(e.to));
    return { nodes, edges };
  }, [raw, tags, weight]);

  // vis data
  const visData = useMemo(() => {
    const now = Date.now();
    const nodes = filtered.nodes.map((n) => {
      const ageDays = Math.max(0, (now - new Date(n.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      // color by recency (green=recent, gray=old)
      const recent = Math.max(0, Math.min(1, 1 - ageDays / 30)); // 0..1
      const r = Math.round(80 + 100 * (1 - recent));
      const g = Math.round(180 + 50 * recent);
      const b = Math.round(200 + 30 * recent);
      const size = 14 + Math.min(20, n.backlinks * 2); // size by backlinks
      return { id: n.id, label: n.label, color: `rgb(${r},${g},${b})`, value: size, title: n.label };
    });
    const edges = filtered.edges.map((e) => ({
      from: e.from, to: e.to, width: 1 + Math.min(6, e.weight), arrows: 'to', color: { opacity: 0.6 },
    }));
    return { nodes, edges };
  }, [filtered]);

  // create / update network
  useEffect(() => {
    if (!container.current) return;
    if (!networkRef.current) {
      networkRef.current = new Network(container.current, { nodes: [], edges: [] }, {
        physics: { stabilization: true, solver: 'forceAtlas2Based' as any },
        interaction: { hover: true, tooltipDelay: 120, navigationButtons: false, keyboard: false, zoomView: true, dragView: true },
        nodes: { shape: 'dot', scaling: { min: 10, max: 36 }, font: { color: colorScheme === 'dark' ? '#eee' : '#222' } },
        edges: { smooth: { type: 'dynamic' }, selectionWidth: 0, color: { inherit: false } },
      });

      const net = networkRef.current;

      net.on('click', (params: any) => {
        const id = params?.nodes?.[0];
        if (id) window.location.href = `/page/${id}`;
      });

      net.on('doubleClick', (params: any) => {
        const id = params?.nodes?.[0];
        if (!id) return;
        // focus neighborhood: keep node and its 1-hop neighbors
        const connected = new Set<string>([id]);
        raw.edges.forEach(e => { if (e.from === id) connected.add(e.to); if (e.to === id) connected.add(e.from); });
        const nodes = raw.nodes.filter(n => connected.has(n.id));
        const nodeSet = new Set(nodes.map(n => n.id));
        const edges = raw.edges.filter(e => nodeSet.has(e.from) && nodeSet.has(e.to));
        net.setData({
          nodes: nodes.map(n => ({ id: n.id, label: n.label })),
          edges: edges.map(e => ({ from: e.from, to: e.to, arrows: 'to' })),
        });
        setTimeout(() => net.fit({ animation: true }), 50);
      });

      net.on('hoverNode', (params: any) => {
        const id = params.node;
        const n = raw.nodes.find(x => x.id === id) || null;
        setHoverNode(n);
        setHoverXY({ x: params.event?.center?.x || 0, y: params.event?.center?.y || 0 });
      });
      net.on('blurNode', () => setHoverNode(null));
      net.on('dragging', () => setHoverNode(null));
      net.on('zoom', () => setHoverNode(null));
    }

    networkRef.current!.setData(visData as any);
    setTimeout(() => networkRef.current!.fit({ animation: false }), 50);
  }, [visData, colorScheme]);

  function fit() { networkRef.current?.fit({ animation: true }); }
  function centerSelection() {
    const sel = networkRef.current?.getSelectedNodes() || [];
    if (sel.length) networkRef.current?.focus(sel[0], { animation: true, scale: 1.2 });
  }
  function exportPng() {
    const canvas = container.current?.getElementsByTagName('canvas')[0];
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'knowledge-graph.png'; a.click();
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Knowledge Graph</Title>
        <Group>
          <ActionIcon onClick={fit} variant="subtle" title="Zoom to fit"><IconZoomReset size={18}/></ActionIcon>
          <ActionIcon onClick={centerSelection} variant="subtle" title="Center on selection"><IconTargetArrow size={18}/></ActionIcon>
          <ActionIcon onClick={exportPng} variant="subtle" title="Export PNG"><IconPhoto size={18}/></ActionIcon>
          <Button variant="light" onClick={load} leftSection={<IconDeviceFloppy size={16}/>}>Refresh</Button>
        </Group>
      </Group>

      <Paper withBorder p="sm" radius="md">
        <Group wrap="wrap" gap="sm">
          <TextInput placeholder="Search title/content…" value={query}
            onChange={(e)=>setQuery(e.currentTarget.value)} onKeyDown={(e)=>{ if (e.key==='Enter') load() }}
            style={{ minWidth: 240 }} />
          <MultiSelect data={allTags} value={tags} onChange={setTags} placeholder="Filter tags" searchable style={{ minWidth: 220 }}/>
          <NumberInput label="Min link weight" min={1} max={10} value={weight} onChange={(v)=>setWeight(Number(v||1))} w={160}/>
          <DatePickerInput type="range" label="Updated between" value={dateRange} onChange={setDateRange}/>
          <Button onClick={load}>Apply</Button>
        </Group>
      </Paper>

      <div style={{ position:'relative' }}>
        <div ref={container} style={{ height: '70vh', border:'1px solid var(--mantine-color-default-border)', borderRadius: 8 }} />
        {hoverNode && (
          <HoverCard opened position="right">
            <HoverCard.Dropdown
              style={{
                position: 'absolute',
                left: hoverXY.x + 12,
                top: hoverXY.y + 12,
                pointerEvents: 'none'
              }}
            >
              <Card shadow="sm" withBorder>
                <Text fw={600}>{hoverNode.label}</Text>
                <Text size="xs" c="dimmed">Updated {new Date(hoverNode.updated_at).toLocaleString()}</Text>
                <Group gap="xs" mt={6}>{(hoverNode.tags||[]).slice(0,6).map(t => <Badge key={t} variant="light">{t}</Badge>)}</Group>
                <Group gap="md" mt="xs">
                  <Text size="xs">Backlinks: {hoverNode.backlinks}</Text>
                  <Text size="xs">Words: {hoverNode.word_count}</Text>
                </Group>
              </Card>
            </HoverCard.Dropdown>
          </HoverCard>
        )}
      </div>
    </Stack>
  );
}

