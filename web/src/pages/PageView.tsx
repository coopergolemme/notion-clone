import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { Stack, Group, TextInput, SegmentedControl, Menu, Button, TagsInput, Divider, Paper } from '@mantine/core'
import RichEditor from '../components/RichEditor'
import LatexEditor from '../components/LatexEditor'

type Page = { id: string; title: string; content: string; tags: string[]; format?: 'rich'|'latex' }

export default function PageView() {
  const { id } = useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [format, setFormat] = useState<'rich'|'latex'>('rich')
  const [tags, setTags] = useState<string[]>([])

  async function load() {
    const { data } = await api.get(`/pages/${id}`)
    setPage(data)
    setFormat((data.format === 'latex' ? 'latex' : 'rich'))
    setTags(Array.isArray(data.tags) ? data.tags : [])
  }
  useEffect(() => { load() }, [id])

  async function save(updates: Partial<Page>) {
    await api.put(`/pages/${id}`, updates)
  }

  async function changeFormat(next: 'rich'|'latex') {
    setFormat(next)
    await save({ format: next })
  }

  async function exportPdf() {
    window.open(`/export/pdf/${id}`, '_blank')
  }

  if (!page) return <div>Loading…</div>

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <TextInput
          value={page.title}
          onChange={(e)=>{ setPage({...page, title: e.currentTarget.value}); save({ title: e.currentTarget.value }) }}
          size="md"
          style={{ flex: 1 }}
        />
        <SegmentedControl
          data={[{ label:'Rich', value:'rich' }, { label:'LaTeX', value:'latex' }]}
          value={format}
          onChange={(v)=>changeFormat(v as any)}
        />
        <Menu>
          <Menu.Target><Button variant="light">Export</Button></Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={exportPdf}>PDF</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Paper withBorder p="md" radius="md" shadow="xs">
        {format === 'rich' ? (
          <RichEditor value={page.content} onChange={(html)=>{ setPage({...page, content: html}); save({ content: html }) }} />
        ) : (
          <LatexEditor value={page.content} onChange={(src)=>{ setPage({...page, content: src}); save({ content: src }) }} />
        )}
      </Paper>

      <Divider my="xs" />

      <TagsInput
        value={tags}
        onChange={(next)=>{ setTags(next); save({ tags: next }) }}
        placeholder="Add tags"
        splitChars={[',', ' ']}
      />
    </Stack>
  )
}
