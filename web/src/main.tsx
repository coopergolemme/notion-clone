import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShellLayout from './shell/AppShellLayout'
import Home from './pages/Home'
import PageView from './pages/PageView'
import Graph from './pages/Graph'
import 'katex/dist/katex.min.css'

const router = createBrowserRouter([
  { path: '/', element: <AppShellLayout />, children: [
    { index: true, element: <Home/> },
    { path: 'page/:id', element: <PageView/> },
    { path: 'graph', element: <Graph/> }
  ]}
])

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <MantineProvider
        defaultColorScheme="auto"
        theme={{
          primaryColor: 'blue',
          defaultRadius: 'md',
          fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          headings: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }
        }}
      >
        <Notifications position="top-right" />
        <ModalsProvider>
          <RouterProvider router={router} />
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
