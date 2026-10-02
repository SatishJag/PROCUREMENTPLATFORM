import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// JSX comes from the root tsconfig (react-jsx), so no React plugin is needed; add @vitejs/plugin-react for Fast Refresh if wanted.
export default defineConfig({
  plugins: [tailwindcss()],
  server: { proxy: { '/api': process.env.API ?? 'http://127.0.0.1:8787' } }, // API=http://127.0.0.1:<port> to target another API instance
});
