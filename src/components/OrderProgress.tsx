import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  orderId: string;
  onClose?: () => void;
};

const STATUS_SEQUENCE = [
  'placed',
  'pending',
  'accepted',
  'confirmed',
  'preparing',
  'cutting',
  'packing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled'
] as const;

const labelFor = (s: string) => {
  switch (s) {
    case 'pending':
      return 'Pending';
    case 'placed':
      return 'Placed';
    case 'accepted':
      return 'Accepted';
    case 'confirmed':
      return 'Confirmed';
    case 'preparing':
      return 'Preparing';
    case 'cutting':
      return 'Cutting';
    case 'packing':
      return 'Packing';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'ready':
      return 'Ready';
    default:
      return s;
  }
};

const Icon = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending':
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3"/></svg>
      );
    case 'accepted':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
      );
    case 'placed':
      return (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg>
      );
    case 'confirmed':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4"/></svg>
      );
    case 'preparing':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h16V4"/></svg>
      );
    case 'cutting':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-2v13"/></svg>
      );
    case 'ready':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 2l4 8-4 4-4-4 4-8z"/></svg>
      );
    case 'packing':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 7h18v13H3z"/></svg>
      );
    case 'out_for_delivery':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 7h13l3 5v6H3z"/></svg>
      );
    case 'delivered':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
      );
    case 'cancelled':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      );
    default:
      return <div className="w-6 h-6" />;
  }
};

export default function OrderProgress({ orderId, onClose }: Props) {
  const [status, setStatus] = useState<string>('pending');
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data, error } = await supabase.from('orders').select('status').eq('id', orderId).single();
        if (error) {
          console.warn('OrderProgress: could not fetch initial status', error);
        } else if (data && mounted) {
          setStatus(data.status || 'pending');
        }
      } catch (err) {
        console.error(err);
      } finally {
        // animate open
        setTimeout(() => setVisible(true), 100);
      }
    };

    load();

    // subscribe to realtime updates for this order
    // older supabase clients use .from(...).on(...).subscribe()
    const subscription = (supabase as any)
      .from(`orders:id=eq.${orderId}`)
      .on('UPDATE', (payload: any) => {
        const newStatus = payload.new?.status;
        if (newStatus) setStatus(newStatus);
      })
      .subscribe();

    return () => {
      mounted = false;
      try {
        if (subscription && subscription.unsubscribe) subscription.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, [orderId]);

  const currentIndex = Math.max(0, STATUS_SEQUENCE.indexOf(status as any));

  return (
    <div className={`fixed left-1/2 transform -translate-x-1/2 bottom-8 z-50 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="w-[92vw] md:w-[720px] bg-white border shadow-lg rounded-lg overflow-hidden">
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Order Tracking</div>
            <div className="text-lg font-semibold">Order #{orderId.slice(0,8)}</div>
            <div className="mt-3 flex items-center gap-3 overflow-x-auto px-1">
              {STATUS_SEQUENCE.map((s, i) => {
                const active = i <= currentIndex;
                return (
                  <div key={s} className="flex items-center gap-2 last:pr-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${active ? 'bg-primary text-white border-primary scale-105 shadow' : 'bg-gray-100 text-gray-500 border-gray-200'} transition-all duration-300`}>
                      <Icon status={s} />
                    </div>
                    <div className={`text-xs ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{labelFor(s)}</div>
                    {i < STATUS_SEQUENCE.length - 1 && (
                      <div className={`w-12 h-0.5 ${i < currentIndex ? 'bg-primary' : 'bg-gray-200'} transition-colors duration-300`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-sm text-muted-foreground">Current</div>
            <div className="text-base font-semibold">{labelFor(status)}</div>
            <button className="text-sm text-red-500 underline mt-2" onClick={() => { setVisible(false); setTimeout(() => onClose && onClose(), 400); }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
