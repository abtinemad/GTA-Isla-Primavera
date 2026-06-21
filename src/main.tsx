import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PosterPreview from './components/PosterPreview.tsx';
import './styles/tokens.css';
import './index.css';

// DEV-ONLY : aperçu de la jaquette pré-remplie via ?poster=1 (jamais en prod).
const posterPreview =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('poster');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {posterPreview ? <PosterPreview /> : <App />}
  </StrictMode>,
);

// Register the PWA service worker (production builds only, to avoid
// interfering with the Vite dev server / HMR).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is best-effort */
    });
  });
}
