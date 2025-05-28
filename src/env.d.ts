/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // 필요하다면 다른 VITE_ 환경변수도 여기에 추가
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
