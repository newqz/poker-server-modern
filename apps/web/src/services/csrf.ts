/**
 * CSRF Token 服务
 * @module services/csrf
 * @author ARCH
 * @date 2026-03-26
 */

const CSRF_TOKEN_KEY = 'csrf_token';

/**
 * 获取 CSRF token
 * 从 cookie 或 storage 中获取
 */
export function getCsrfToken(): string | null {
  // 首先尝试从 cookie 读取
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_TOKEN_KEY) {
      return value;
    }
  }
  
  // 回退到 localStorage
  return localStorage.getItem(CSRF_TOKEN_KEY);
}

/**
 * 设置 CSRF token
 */
export function setCsrfToken(token: string): void {
  // 同时设置 cookie（用于同源请求）
  document.cookie = `${CSRF_TOKEN_KEY}=${token}; path=/; SameSite=Strict`;
  // 也存储在 localStorage 作为备份
  localStorage.setItem(CSRF_TOKEN_KEY, token);
}

/**
 * 生成 CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 请求头中添加 CSRF token
 */
export function addCsrfHeader(headers: Record<string, string>): Record<string, string> {
  const token = getCsrfToken();
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token
    };
  }
  return headers;
}
