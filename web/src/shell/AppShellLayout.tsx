import { AppShell } from '@mantine/core'
import { Outlet } from 'react-router-dom'
import HeaderBar from './HeaderBar'
import LeftNav from './LeftNav'
import RightAside from './RightAside'
import { useState } from 'react'

export default function AppShellLayout() {
  const [navOpened, setNavOpened] = useState(true)
  const [asideOpened, setAsideOpened] = useState(true)

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !navOpened } }}
      aside={{ width: 340, breakpoint: 'lg', collapsed: { desktop: !asideOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <HeaderBar onToggleNav={() => setNavOpened(v => !v)} onToggleAside={() => setAsideOpened(v => !v)} />
      </AppShell.Header>

      <AppShell.Navbar>
        <LeftNav />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Aside>
        <RightAside />
      </AppShell.Aside>
    </AppShell>
  )
}
