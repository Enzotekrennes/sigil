/**
 * Vitest setup, run before every unit test file.
 *
 * Registers the Testing Library DOM matchers (`toHaveTextContent`, …) and
 * unmounts rendered components after each test, since Vitest globals are
 * disabled and Testing Library cannot register its own cleanup.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
