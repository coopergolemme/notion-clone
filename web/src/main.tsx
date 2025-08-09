import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Spotlight } from "@mantine/spotlight";
import { useSpotlightSearch } from "./hooks/useSpotlightSearch";
import AppShellLayout from "./shell/AppShellLayout";
import Home from "./pages/Home";
import PageView from "./pages/PageView";
import Graph from "./pages/Graph";
import "katex/dist/katex.min.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShellLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "page/:id", element: <PageView /> },
      { path: "graph", element: <Graph /> },
    ],
  },
]);

const qc = new QueryClient();

function Root() {
  const { actions, setQuery } = useSpotlightSearch();
  return (
    <QueryClientProvider client={qc}>
      <MantineProvider
        defaultColorScheme="auto"
        theme={{
          primaryColor: "blue",
          defaultRadius: "md",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          headings: {
            fontFamily:
              "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          },
        }}>
        <Notifications position="top-right" />
        <ModalsProvider>
          <Spotlight
            actions={actions}
            nothingFound="Type to search pages…"
            highlightQuery
            shortcut={["mod + K"]}
            limit={8}
            searchProps={{ placeholder: "Search or ask…" }}
            filter={(query, actions) => actions}
            onQueryChange={setQuery}
          />
          <RouterProvider router={router} />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
