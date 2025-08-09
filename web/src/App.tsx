import { Link, Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div style={{fontFamily:'ui-sans-serif', padding:16, maxWidth:1000, margin:'0 auto'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h1 style={{fontSize:20}}>Notion AI Starter</h1>
        <nav style={{display:'flex', gap:12}}>
          <Link to="/">Table</Link>
          <Link to="/graph">Graph</Link>
        </nav>
      </header>
      <Outlet/>
    </div>
  )
}
