import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: base must match your GitHub repo name exactly, with slashes on both sides.
// If your repo is named "roxas-ledger", this should be '/roxas-ledger/'.
// If you rename the repo, update this to match.
export default defineConfig({
  plugins: [react()],
  base: '/Roxas-Family-Ledger/',
});
