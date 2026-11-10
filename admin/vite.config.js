import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 운영 콘솔 (관리자 전용). 사용자 웹(web/, 5173)과 구분하기 위해 포트를 5174 로 둔다.
export default defineConfig({
  plugins: [vue()],
  server: { port: 5174 }
});
