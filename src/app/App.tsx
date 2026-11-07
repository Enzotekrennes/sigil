/**
 * Application shell: the single screen of Sigil.
 *
 * For now it only renders the page heading; the intention form, the sigil
 * scene and the explanation panel are assembled here by later features.
 */
import './App.css';

/**
 * Renders the main landmark of the page with the "Sigil" title.
 *
 * @returns The application screen.
 */
export function App() {
  return (
    <main className="app">
      <h1 className="app__title">Sigil</h1>
    </main>
  );
}
