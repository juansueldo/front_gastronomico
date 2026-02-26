import { RouterProvider } from 'react-router';
import { router } from './routes.tsx';

export default function App() {
  return (
    <div className="size-full dark">
      <RouterProvider router={router} />
    </div>
  );
}