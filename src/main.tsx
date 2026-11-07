/**
 * Browser entry point: loads the global stylesheets (tokens, local fonts,
 * base styles) and mounts the React app into `#root` of `index.html`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App.tsx';
import './styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';

/** Id of the mount node declared in `index.html`. */
const ROOT_ELEMENT_ID = 'root';

const rootElement = document.getElementById(ROOT_ELEMENT_ID);
if (!rootElement) {
  throw new Error(`Cannot start Sigil: no element with id "${ROOT_ELEMENT_ID}" in index.html.`);
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
