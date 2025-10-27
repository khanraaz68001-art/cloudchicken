import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * LiveUpdates: subscribes to Supabase realtime changes and broadcasts
 * lightweight CustomEvents so the rest of the app can react.
 *
 * Events emitted:
 * - daily_sales_inserted -> detail = payload
 * - order_updated -> detail = new row
 * - order_delivered -> detail = new row (when order status === 'delivered')
 * - product_updated -> detail = payload
 */
export default function LiveUpdates() {
  useEffect(() => {
    // Newer supabase-js (v2) exposes channel-based realtime API. We try that first
    // and fall back to the older `.from(...).on(...).subscribe()` API if necessary.
    try {
      if ((supabase as any).channel) {
        const ch = (supabase as any).channel('public:live_updates');

        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_sales' }, (payload: any) => {
          try { window.dispatchEvent(new CustomEvent('daily_sales_inserted', { detail: payload })); } catch (e) {}
          // If there's an order_id in the payload, let listeners know an order was delivered
          try { if (payload?.new) window.dispatchEvent(new CustomEvent('order_delivered', { detail: payload.new })); } catch (e) {}
        });

        ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload: any) => {
          try { window.dispatchEvent(new CustomEvent('order_updated', { detail: payload.new })); } catch (e) {}
          try { if (payload?.new?.status === 'delivered') window.dispatchEvent(new CustomEvent('order_delivered', { detail: payload.new })); } catch (e) {}
          try { if (payload?.new?.status === 'cancelled') window.dispatchEvent(new CustomEvent('order_cancelled', { detail: payload.new })); } catch (e) {}
        });

        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload: any) => {
          try { window.dispatchEvent(new CustomEvent('product_updated', { detail: payload })); } catch (e) {}
        });

        ch.subscribe();

        return () => {
          try { ch.unsubscribe(); } catch (e) {}
        };
      }
    } catch (e) {
      console.warn('LiveUpdates (channel) setup failed, falling back if possible', e);
    }

    // Fallback for older supabase client realtime API
    try {
      const dailySub = (supabase as any).from?.('daily_sales').on('*', (payload: any) => {
        try { window.dispatchEvent(new CustomEvent('daily_sales_inserted', { detail: payload })); } catch (e) {}
        try { if (payload?.new) window.dispatchEvent(new CustomEvent('order_delivered', { detail: payload.new })); } catch (e) {}
      }).subscribe?.();

      const ordersSub = (supabase as any).from?.('orders').on('UPDATE', (payload: any) => {
        try { window.dispatchEvent(new CustomEvent('order_updated', { detail: payload.new })); } catch (e) {}
        try { if (payload?.new?.status === 'delivered') window.dispatchEvent(new CustomEvent('order_delivered', { detail: payload.new })); } catch (e) {}
        try { if (payload?.new?.status === 'cancelled') window.dispatchEvent(new CustomEvent('order_cancelled', { detail: payload.new })); } catch (e) {}
      }).subscribe?.();

      const prodSub = (supabase as any).from?.('products').on('*', (payload: any) => {
        try { window.dispatchEvent(new CustomEvent('product_updated', { detail: payload })); } catch (e) {}
      }).subscribe?.();

      return () => {
        try { (supabase as any).removeSubscription?.(dailySub); } catch (e) {}
        try { (supabase as any).removeSubscription?.(ordersSub); } catch (e) {}
        try { (supabase as any).removeSubscription?.(prodSub); } catch (e) {}
      };
    } catch (e) {
      console.warn('LiveUpdates (fallback) failed', e);
    }
  }, []);

  return null;
}
