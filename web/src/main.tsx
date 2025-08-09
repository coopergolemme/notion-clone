import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import PageView from './pages/PageView'
import Graph from './pages/Graph'

const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <Home/> },
    { path: 'page/:id', element: <PageView/> },
    { path: 'graph', element: <Graph/> }
  ]}
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
