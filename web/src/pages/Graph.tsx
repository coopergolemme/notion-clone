import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Network } from 'vis-network'
import { Group, ActionIcon, Paper, Stack } from '@mantine/core'
import { IconZoomIn, IconZoomOut, IconArrowsMaximize, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react'

export default function Graph() {
  const el = useRef<HTMLDivElement | null>(null)
  const networkRef = useRef<Network | null>(null)
  const [physics, setPhysics] = useState(true)

  useEffect(() => {
    let network: Network | null = null
    async function load() {
      const { data } = await api.get('/graph')
      if (!el.current) return
      network = new Network(el.current, data, {
        nodes: { shape: 'dot', size: 12, font: { size: 14 } },
        edges: { arrows: { to: { enabled: true, scaleFactor: 0.6 } }, color: '#bbb' },
        physics: { stabilization: true },
        interaction: { hover: true }
      })
      networkRef.current = network
      network.on('doubleClick', (params: any) => {
        const id = params?.nodes?.[0]
        if (id) window.location.href = `/page/${id}`
      })
    }
    load()
    return () => { if (network) network.destroy() }
  }, [])

  function zoom(f: number) {
    const n = networkRef.current
    if (!n) return
    const scale = n.getScale() * f
    n.moveTo({ scale })
  }

  function fit() {
    networkRef.current?.fit()
  }

  function togglePhysics() {
    const n = networkRef.current
    if (!n) return
    const next = !physics
    n.setOptions({ physics: next })
    setPhysics(next)
  }

  return (
    <Stack>
      <Group gap="xs">
        <ActionIcon variant="light" onClick={() => zoom(1.2)}><IconZoomIn size={16} /></ActionIcon>
        <ActionIcon variant="light" onClick={() => zoom(0.8)}><IconZoomOut size={16} /></ActionIcon>
        <ActionIcon variant="light" onClick={fit}><IconArrowsMaximize size={16} /></ActionIcon>
        <ActionIcon variant="light" onClick={togglePhysics}>
          {physics ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
        </ActionIcon>
      </Group>
      <Paper withBorder radius="md" style={{ height: '70vh' }}>
        <div ref={el} style={{ height: '100%' }} />
      </Paper>
    </Stack>
  )
}
