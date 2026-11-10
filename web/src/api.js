import { supabase } from './supabase';
import { createDataApi } from './supabaseApi';

// 기존 axios + Spring Boot API 를 Supabase 로 교체. 호출부(api.trips.list() 등)는 그대로다.
export const api = createDataApi(supabase);
