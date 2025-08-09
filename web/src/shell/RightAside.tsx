import { Tabs, ScrollArea, Stack, Button, List, Text, Group, Badge, Textarea } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'

export default function RightAside() {
  const loc = useLocation()
  const m = loc.pathname.match(/\/page\/(.+)$/)
  const pageId = m?.[1]

  const [backlinks, setBacklinks] = useState<any[]>([])
  const [related, setRelated] = useState<any[]>([])
  const [ask, setAsk] = useState('')
  const [answer, setAnswer] = useState('')
  const [answering, setAnswering] = useState(false)

  useEffect(() => {
    if (!pageId) return
    api.get(`/pages/${pageId}/backlinks`).then(({data})=>setBacklinks(data))
    api.post('/ai/related', { pageId, k: 5 }).then(({data})=>setRelated(data))
  }, [pageId])

  async function askAI() {
    setAnswering(true)
    try {
      const { data } = await api.post('/ai/answer', { query: ask, k: 5 })
      setAnswer(data?.answer || '')
    } finally { setAnswering(false) }
  }

  return (
    <Tabs defaultValue="ai" keepMounted={false}>
      <Tabs.List grow>
        <Tabs.Tab value="ai">AI</Tabs.Tab>
        <Tabs.Tab value="backlinks">Backlinks</Tabs.Tab>
        <Tabs.Tab value="related">Related</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="ai" p="md">
        <Stack gap="sm">
          <Textarea value={ask} onChange={(e)=>setAsk(e.currentTarget.value)} placeholder="Ask across your pages…" autosize minRows={2}/>
          <Button loading={answering} onClick={askAI}>Ask</Button>
          {answer && <Text size="sm">{answer}</Text>}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="backlinks" p="md">
        <ScrollArea>
          {!backlinks.length && <Text c="dimmed" size="sm">No backlinks yet</Text>}
          <List>
            {backlinks.map((b:any)=>(
              <List.Item key={b.id}><a href={`/page/${b.id}`}>{b.title}</a></List.Item>
            ))}
          </List>
        </ScrollArea>
      </Tabs.Panel>

      <Tabs.Panel value="related" p="md">
        <ScrollArea>
          {!related.length && <Text c="dimmed" size="sm">No related pages yet</Text>}
          <Stack>
            {related.map((r:any)=>(
              <Group key={r.id} justify="space-between">
                <a href={`/page/${r.id}`}>{r.title}</a>
                <Badge variant="light">similar</Badge>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      </Tabs.Panel>
    </Tabs>
  )
}
