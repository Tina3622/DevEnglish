/**
 * Supabase 客户端
 * 用于认证、云同步、Edge Function 调用
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 未配置')
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,       // localStorage 存 session
      autoRefreshToken: true,
    },
  },
)

/**
 * 获取当前登录用户 ID，未登录返回 null
 */
export function getUserId(): string | null {
  return supabase.auth.getSession().then(({ data }) => {
    return data.session?.user?.id ?? null
  }) as unknown as string | null
}
