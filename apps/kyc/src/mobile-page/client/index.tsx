import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('app')!;
createRoot(container).render(
  <App
    token={(window as any).__TOKEN as string}
    api={(window as any).__API as string}
  />
);
