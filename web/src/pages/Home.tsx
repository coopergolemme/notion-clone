import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Button, Card, Badge, Group, Stack, SimpleGrid, Text, Title } from '@mantine/core'
import { DataTable } from '@mantine/datatable'

type Row = { id: string; title: string; snippet: string; tags: string[]; created_at?: string }

export default function Home() {
  const [rows, setRows] = useState<Row[]>([])
  const loc = useLocation()
  const nav = useNavigate()
  const params = new URLSearchParams(loc.search)
  const view = params.get('view') || 'table'
  const tagsParam = params.get('tags') || ''
  const activeTags = useMemo(()=> tagsParam ? tagsParam.split(',').filter(Boolean) : [], [tagsParam])

  async function load() {
    const { data } = await api.get<Row[]>('/pages')
    setRows(data)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!activeTags.length) return rows
    return rows.filter(r => (r.tags || []).some(t => activeTags.includes(t)))
  }, [rows, activeTags])

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Your Pages</Title>
        <Button onClick={()=>nav('/') /* optional create flow */}>New Page</Button>
      </Group>

      {view === 'table' ? (
        <DataTable
          withTableBorder
          withColumnBorders
          striped
          highlightOnHover
          records={filtered}
          columns={[
            { accessor: 'title', title: 'Title', render: (r)=> <a href={`/page/${r.id}`}>{r.title}</a> },
            { accessor: 'snippet', title: 'Snippet' },
            {
              accessor: 'tags',
              title: 'Tags',
              render: (r) => <Group gap="xs">{(r.tags||[]).map(t=><Badge key={t} variant="light">{t}</Badge>)}</Group>
            },
          ]}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {filtered.map(r => (
            <Card key={r.id} withBorder shadow="sm">
              <Stack gap={6}>
                <a href={`/page/${r.id}`}><Text fw={600}>{r.title}</Text></a>
                <Text size="sm" c="dimmed">{r.snippet}</Text>
                <Group gap="xs">
                  {(r.tags||[]).map(t => <Badge key={t} variant="light">{t}</Badge>)}
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}
