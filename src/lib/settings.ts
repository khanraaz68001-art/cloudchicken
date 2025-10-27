import { supabase } from './supabase';

const CACHE_PREFIX = 'cloudcoop_setting_';

export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (cached) return cached;
  } catch (e) {
    // ignore localStorage errors
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .limit(1);

    if (error) {
      console.error('getAppSetting error', error);
      return null;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    const value = Array.isArray(data) ? data[0].value : (data as any).value;

    try { if (value !== null && value !== undefined) localStorage.setItem(CACHE_PREFIX + key, value); } catch (e) {}

    return value ?? null;
  } catch (err) {
    console.error('getAppSetting unexpected error', err);
    return null;
  }
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key, value }], { onConflict: 'key' });

    if (error) throw error;

    try { localStorage.setItem(CACHE_PREFIX + key, value); } catch (e) {}
  } catch (err) {
    console.error('setAppSetting error', err);
    throw err;
  }
}

export async function clearAppSettingCache(key: string) {
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {}
}

// Metrics helpers (server-backed)
export async function getMetric(key: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('get_metric', { metric_key: key });
    if (error) {
      console.error('getMetric error', error);
      return null;
    }
    // rpc may return null; cast to number
    return data as number | null;
  } catch (err) {
    console.error('getMetric unexpected error', err);
    return null;
  }
}

export async function incrementMetric(key: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('increment_metric', { metric_key: key });
    if (error) {
      console.error('incrementMetric error', error);
      return null;
    }
    return data as number | null;
  } catch (err) {
    console.error('incrementMetric unexpected error', err);
    return null;
  }
}
