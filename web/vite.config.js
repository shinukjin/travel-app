import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 데이터는 Supabase(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)에서 직접 가져오므로 API 프록시가 필요 없다.
export default defineConfig({
  plugins: [vue()],
  server: { port: 5173 }
});
