import { AppShell } from "@mantine/core";
import { Outlet } from "react-router-dom";
import HeaderBar from "./HeaderBar";
import LeftNav from "./LeftNav";
import RightAside from "./RightAside";
import { useEffect, useState } from "react";
import { OPEN_ASK_AI_EVENT } from "../utils/events";

export default function AppShellLayout() {
  const [navOpened, setNavOpened] = useState(false);
  const [asideOpened, setAsideOpened] = useState(false);

  useEffect(() => {
    const handleOpenAskAI = () => setAsideOpened(true);
    window.addEventListener(
      OPEN_ASK_AI_EVENT,
      handleOpenAskAI as EventListener
    );
    return () =>
      window.removeEventListener(
        OPEN_ASK_AI_EVENT,
        handleOpenAskAI as EventListener
      );
  }, []);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !navOpened, desktop: !navOpened },
      }}
      aside={{
        width: 340,
        breakpoint: "lg",
        collapsed: { desktop: !asideOpened },
      }}
      padding="md">
      <AppShell.Header>
        <HeaderBar
          onToggleNav={() => setNavOpened((v) => !v)}
          onToggleAside={() => setAsideOpened((v) => !v)}
        />
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
  );
}
