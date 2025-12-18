import { supabase } from './supabase';
import { getAppSetting, setAppSetting } from './settings';

type DiscountRecord = {
  id?: string;
  code: string;
  type: 'percentage' | 'flat';
  amount: number; // percentage (0-100) or flat rupees
  active?: boolean;
  description?: string;
  // validity/scope: always = no restriction, first_time = only for first orders, date_range = limited between start_at and end_at
  scope?: 'always' | 'first_time' | 'date_range';
  // ISO timestamps for range boundaries (optional)
  start_at?: string | null;
  end_at?: string | null;
};

// Try to fetch discount codes from a dedicated table; if not present, fallback to app setting 'discount_codes'
export async function fetchDiscountCodes(): Promise<DiscountRecord[]> {
  try {
    const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      return data as DiscountRecord[];
    }
  } catch (e) {
    // ignore
  }
  // fallback to app setting
  try {
    const raw = await getAppSetting('discount_codes');
    if (raw) return JSON.parse(raw) as DiscountRecord[];
  } catch (e) {}
  return [];
}

export async function createDiscountCode(record: DiscountRecord): Promise<{ success: boolean; message?: string }> {
  // try DB insert first
  try {
    // attempt full payload insert
    const { data, error } = await supabase.from('discount_codes').insert([record]).select('*');
    if (!error) return { success: true };

    // If we received a 400 / bad request often it's due to unknown columns in the payload (DB schema older).
    const errMsg = String((error as any)?.message || (error as any)?.details || '');
    const isBadRequest = (error as any)?.status === 400 || /could not find the '.+' column/i.test(errMsg) || /column .+ does not exist/i.test(errMsg);
    if (isBadRequest) {
      // try conservative insert with core fields only to avoid schema mismatch
      const core: any = {
        code: record.code,
        type: record.type,
        amount: record.amount,
        description: record.description || null,
        active: record.active ?? true
      };
      const { error: coreErr } = await supabase.from('discount_codes').insert([core]).select('*');
      if (!coreErr) return { success: true };
      // if core insert also failed, fall through to app-setting fallback
    }
    // otherwise fall back to settings
    throw error;
  } catch (e) {
    // fallback to storing in app setting
    try {
      const existingRaw = await getAppSetting('discount_codes');
      const existing = existingRaw ? JSON.parse(existingRaw) as DiscountRecord[] : [];
      existing.unshift(record);
      await setAppSetting('discount_codes', JSON.stringify(existing));
      return { success: true };
    } catch (e2) {
      return { success: false, message: (e2 as any)?.message || 'Failed to save discount code' };
    }
  }
}

export async function getActiveBanner(): Promise<{ text: string; show_on_menu?: boolean } | null> {
  try {
    const raw = await getAppSetting('active_discount_banner');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function setActiveBanner(payload: { text: string; show_on_menu?: boolean }) {
  return setAppSetting('active_discount_banner', JSON.stringify(payload));
}

export async function validateCode(code: string, codes: DiscountRecord[], subtotal: number, opts?: { userId?: string }) {
  if (!code) return { valid: false, message: 'Enter a coupon code' };
  const found = codes.find(c => c.code.toLowerCase() === code.toLowerCase() && (c.active ?? true));
  if (!found) return { valid: false, message: 'Invalid or inactive code' };

  // date range enforcement
  try {
    const now = new Date();
    if (found.scope === 'date_range') {
      if (found.start_at) {
        const start = new Date(found.start_at as string);
        if (now < start) return { valid: false, message: 'Coupon is not active yet' };
      }
      if (found.end_at) {
        const end = new Date(found.end_at as string);
        if (now > end) return { valid: false, message: 'Coupon has expired' };
      }
    }
  } catch (e) {
    // ignore parse issues and continue
  }

  // first-time enforcement: require userId in opts and ensure they have no previous orders
  if (found.scope === 'first_time') {
    if (!opts || !opts.userId) {
      return { valid: false, message: 'Login required to validate this coupon' };
    }
    try {
      const { count, error } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', opts.userId as string);
      if (error) {
        console.warn('validateCode: failed to check user orders', error);
        return { valid: false, message: 'Failed to validate coupon' };
      }
      if ((count || 0) > 0) {
        return { valid: false, message: 'This coupon is valid only for first-time orders' };
      }
    } catch (e) {
      return { valid: false, message: 'Failed to validate coupon' };
    }
  }

  let discountAmount = 0;
  if (found.type === 'percentage') {
    discountAmount = Math.round((subtotal * (found.amount / 100)) * 100) / 100;
  } else {
    discountAmount = Math.round((found.amount) * 100) / 100;
  }
  return { valid: true, record: found, discountAmount };
}

export type { DiscountRecord };
