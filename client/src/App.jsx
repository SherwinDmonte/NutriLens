import { RouterProvider } from 'react-router-dom';

import { appRouter } from './router.jsx';

export function App() {
  return <RouterProvider router={appRouter} />;
}
