import { useEffect, useRef } from 'react'
import { api } from '../api'
import { Network } from 'vis-network'

export default function Graph() {
  const el = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let network: Network | null = null
    async function load() {
      const { data } = await api.get('/graph')
      if (!el.current) return
      network = new Network(el.current, data, {
        nodes: { shape: 'dot', size: 12, font: { size: 14 } },
        edges: { arrows: { to: { enabled: true, scaleFactor: 0.6 } }, color: '#bbb' },
        physics: { stabilization: true }
      })
      network.on('doubleClick', (params: any) => {
        const id = params?.nodes?.[0]
        if (id) window.location.href = `/page/${id}`
      })
    }
    load()
    return () => { if (network) network.destroy() }
  }, [])

  return <div style={{ height: '70vh', border: '1px solid #eee', borderRadius: 6 }} ref={el} />
}
