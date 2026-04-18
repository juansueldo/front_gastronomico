import { AppLayout } from './AppLayout';
import React from 'react';

export function DashboardView() {
  return (
    <AppLayout>
      <div style={{ padding: 32 }}>
        <h1>Dashboard</h1>
        <p>Bienvenido al panel principal.</p>
        {/* Aquí puedes agregar widgets, KPIs, accesos rápidos, etc. */}
      </div>
    </AppLayout>
  );
}
