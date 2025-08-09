import { ScrollArea, Stack, Title, SegmentedControl, MultiSelect, Divider, Button } from '@mantine/core'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api'

export default function LeftNav() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [tags, setTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/pages')
      const set = new Set<string>()
      data.forEach((p:any) => (p.tags || []).forEach((t:string)=>set.add(t)))
      setAllTags(Array.from(set.values()).sort())
    })()
  }, [])

  function applyFilters(nextTags: string[]) {
    setTags(nextTags)
    const q = new URLSearchParams(params)
    q.set('tags', nextTags.join(','))
    setParams(q, { replace: true })
  }

  return (
    <ScrollArea p="md">
      <Stack gap="sm">
        <Title order={5}>View</Title>
        <SegmentedControl
          data={[
            { label: 'Table', value: 'table' },
            { label: 'Gallery', value: 'gallery' },
          ]}
          value={params.get('view') || 'table'}
          onChange={(v)=>{ const q=new URLSearchParams(params); q.set('view', v); setParams(q, { replace:true }) }}
        />
        <Divider my="xs" />
        <Title order={5}>Filter by Tags</Title>
        <MultiSelect
          data={allTags}
          value={tags}
          placeholder="Select tags"
          searchable
          onChange={applyFilters}
        />
        <Divider my="xs" />
        <Button onClick={()=>nav('/')}>New Page</Button>
      </Stack>
    </ScrollArea>
  )
}
