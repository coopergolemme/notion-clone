import { useEffect, useMemo, useState } from 'react'
import { Drawer, Stack, Group, Button, Text, ScrollArea, Select, Divider } from '@mantine/core'
import { api } from '../api'
import { diffPrettyHtml } from '../utils/diff'

export default function HistoryDrawer({ pageId, opened, onClose, currentTitle, currentContent }:{
  pageId: string
  opened: boolean
  onClose: () => void
  currentTitle: string
  currentContent: string
}) {
  const [versions, setVersions] = useState<any[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [selected, setSelected] = useState<any | null>(null)
  const [restoring, setRestoring] = useState(false)

  async function load() {
    const { data } = await api.get(`/pages/${pageId}/history`)
    setVersions(data)
    setSel(data?.[0]?.id || null)
  }

  useEffect(() => { if (opened) load() }, [opened])

  useEffect(() => {
    if (!sel) { setSelected(null); return }
    api.get(`/pages/${pageId}/history/${sel}`).then(({data}) => setSelected(data))
  }, [sel, pageId])

  const titleHtml = useMemo(() => selected ? diffPrettyHtml(selected.title, currentTitle) : '', [selected, currentTitle])
  const contentHtml = useMemo(() => selected ? diffPrettyHtml(selected.content, currentContent) : '', [selected, currentContent])

  async function restore() {
    if (!sel) return
    setRestoring(true)
    try {
      await api.post(`/pages/${pageId}/history/${sel}/restore`)
      window.location.reload()
    } finally { setRestoring(false) }
  }

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="xl" title="Version history">
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Version"
            data={versions.map((v:any)=>({ value: v.id, label: new Date(v.created_at).toLocaleString() }))}
            value={sel}
            onChange={setSel}
            placeholder="Select a version"
          />
          <Button disabled={!sel} loading={restoring} onClick={restore}>Restore</Button>
        </Group>
        <Divider/>
        <Text fw={600}>Title diff</Text>
        <ScrollArea h={80} p="xs" style={{ border:'1px solid #eee', borderRadius:6 }}>
          <div dangerouslySetInnerHTML={{ __html: titleHtml }} />
        </ScrollArea>
        <Text fw={600}>Content diff</Text>
        <ScrollArea h={420} p="xs" style={{ border:'1px solid #eee', borderRadius:6 }}>
          <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
        </ScrollArea>
      </Stack>
    </Drawer>
  )
}
