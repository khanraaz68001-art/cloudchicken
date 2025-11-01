import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const STATUS_SEQUENCE = [
  'placed', 'packing', 'out_for_delivery', 'delivered'
];

const labelFor = (s: string) => ({
  placed: 'Placed', packing: 'Packed', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled'
}[s] || s);

export default function PersistentOrderBar() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState<any | null>(null);

  // UI state & refs must be declared unconditionally to preserve Hooks order
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [forceFullFill, setForceFullFill] = useState(false);
  const [deliveredVisible, setDeliveredVisible] = useState(false);
  const [cancelledVisible, setCancelledVisible] = useState(false);
  // When other UI (like an order details modal) is open we hide the bar to avoid overlap
  const [modalOpen, setModalOpen] = useState(false);
  const [productName, setProductName] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const deliveredTimerRef = useRef<number | null>(null);
  const cancelledTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (deliveredTimerRef.current) window.clearTimeout(deliveredTimerRef.current);
    };
  }, []);

  // Debug: Track showDeliveredModal changes
  useEffect(() => {
    console.log('showDeliveredModal changed to:', showDeliveredModal, 'Current path:', location.pathname);
  }, [showDeliveredModal, location.pathname]);

  useEffect(() => {
    if (!userProfile?.id) return;
    let mounted = true;
    const loadLatest = async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mounted && data) setOrder(data);
      } catch (e) {
        console.warn('PersistentOrderBar load error', e);
      }
    };

    // initial load
    loadLatest();

    // Poll for updates every 5 seconds (works reliably on mobile and avoids realtime subscription complexity)
    const interval = setInterval(loadLatest, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [userProfile?.id]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const current = order?.status;
    // If we haven't recorded a previous status for this session, treat this as initial load
    // and don't run the delivered flow (prevents firing when component mounts and order is already delivered).
    if (prev === null) {
      prevStatusRef.current = current || null;
      return;
    }

  if (prev !== 'delivered' && current === 'delivered') {
      // Wrap async operations so we can await product lookups before showing toast/modal
      (async () => {
        try {
          // Trigger full bar fill animation 
          setForceFullFill(true);
          
          // Only show delivered modal for customers (not on admin/delivery/kitchen pages)
          const isCustomerScreen = !location.pathname.includes('/admin') && 
                                  !location.pathname.includes('/delivery') && 
                                  !location.pathname.includes('/kitchen') &&
                                  !location.pathname.includes('/daily-sales');
          
          console.log('Order delivered - Current path:', location.pathname, 'Is customer screen:', isCustomerScreen);
          
          if (isCustomerScreen) {
            console.log('Setting showDeliveredModal to true');
            setShowDeliveredModal(true);
          } else {
            console.log('Not showing modal - on admin/staff screen');
          }
          // show the bar for 10s then hide
          setDeliveredVisible(true);
          if (deliveredTimerRef.current) window.clearTimeout(deliveredTimerRef.current);
          deliveredTimerRef.current = window.setTimeout(() => {
            setDeliveredVisible(false);
          }, 10000);

          // Attempt to fetch product name (prefer joined data if present)
          let prodName = order?.products?.name || order?.product_name || null;
          if (!prodName && order?.product_id) {
            try {
              const { data: prod } = await supabase.from('products').select('name').eq('id', order.product_id).maybeSingle();
              prodName = prod?.name || prodName;
            } catch (e) {
              // ignore fetch failures, fallback to id
            }
          }
          setProductName(prodName || null);

          // small toast removed; we only show the delivered modal now

          // clear the force after a brief animation window so the bar can hide normally
          setTimeout(() => setForceFullFill(false), 1200);

          // record sale in daily_sales table (avoid duplicates)
          try {
            if (!order?.id) return;
            const { data: exists } = await supabase.from('daily_sales').select('id').eq('order_id', order.id).maybeSingle();
            if (exists) return; // already recorded

            // fetch customer info
            const { data: userProf } = await supabase.from('user_profiles').select('name,whatsapp_number').eq('id', order.user_id).maybeSingle();

            const payload = {
              sale_date: new Date().toISOString().slice(0,10),
              order_id: order.id,
              customer_name: userProf?.name || null,
              customer_phone: userProf?.whatsapp_number || null,
              product_id: order.product_id || null,
              product_name: prodName || null,
              quantity: order.weight_kg || null
            };

            await supabase.from('daily_sales').insert(payload);
            // Clear customer's cart after delivery so they start fresh next order
            try {
              localStorage.removeItem('cloudcoop_cart');
              // notify other tabs/components (Navbar listens for this)
              window.dispatchEvent(new Event('cart_updated'));
              // notify homepage and other listeners that an order was delivered
              try { window.dispatchEvent(new CustomEvent('order_delivered', { detail: { orderId: order.id } })); } catch (e) { /* ignore */ }
            } catch (e) {
              // ignore
            }
          } catch (e) {
            console.warn('Failed to record daily sale', e);
          }
        } catch (e) {
          console.warn('Error in delivered flow', e);
        }
      })();
    }

    // Cancelled flow: show apology modal and notify listeners
    if (prev !== 'cancelled' && current === 'cancelled') {
      (async () => {
        try {
          setShowCancelledModal(true);
          setCancelledVisible(true);
          if (cancelledTimerRef.current) window.clearTimeout(cancelledTimerRef.current);
          cancelledTimerRef.current = window.setTimeout(() => {
            setCancelledVisible(false);
          }, 8000);

          // allow a brief visual force so the bar can be noticed
          setForceFullFill(true);
          setTimeout(() => setForceFullFill(false), 900);

          // notify other listeners that an order was cancelled
          try { window.dispatchEvent(new CustomEvent('order_cancelled', { detail: { orderId: order?.id } })); } catch (e) {}
        } catch (e) {
          console.warn('Error in cancelled flow', e);
        }
      })();
    }
    prevStatusRef.current = current || null;
  }, [order?.status]);

  // Listen for order detail modal open/close events so we can hide while a modal is active
  useEffect(() => {
    const onOpen = () => setModalOpen(true);
    const onClose = () => setModalOpen(false);
    window.addEventListener('order_modal_open', onOpen as EventListener);
    window.addEventListener('order_modal_close', onClose as EventListener);
    return () => {
      window.removeEventListener('order_modal_open', onOpen as EventListener);
      window.removeEventListener('order_modal_close', onClose as EventListener);
    };
  }, []);

  // Determine visibility but keep the element in the DOM so animations and
  // the WhatsApp float can read its size. We expose a data-visible attribute
  // so other components can decide whether to treat it as present.
  const hasOrder = !!order;
  const isDelivered = order?.status === 'delivered';
  const isCancelled = order?.status === 'cancelled';
  // Hide the bar when order is delivered (unless showing delivered animation) or cancelled
  const isVisible = !!userProfile && hasOrder && (!isDelivered || deliveredVisible) && !isCancelled && !modalOpen;

  const activeIndex = Math.max(0, STATUS_SEQUENCE.indexOf(order?.status ?? 'placed'));

  // Basic icons mapping
  const IconFor = ({ s }: { s: string }) => {
    const common = 'w-5 h-5';
    switch (s) {
      case 'packing': return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 3v18" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
      case 'out_for_delivery': return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 7h13l3 5v6H3z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="7.5" cy="19" r="1.5" strokeWidth={2} />
          <circle cx="17.5" cy="19" r="1.5" strokeWidth={2} />
        </svg>
      );
      default: return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg>;
    }
  };

  // compute progress percent
  const progressPercent = forceFullFill || order?.status === 'delivered' ? 100 : Math.max(0, Math.min(100, (activeIndex / Math.max(1, STATUS_SEQUENCE.length - 1)) * 100));


  return (
  <div id="persistent-order-bar" data-visible={isVisible ? 'true' : 'false'} className={`fixed bottom-0 left-0 right-0 z-50 pointer-events-auto transform transition-transform transition-opacity duration-300 ease-in-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
    <div className="w-full bg-white/95 backdrop-blur-sm border-t shadow-inner safe-bottom" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
  <div className="max-w-5xl mx-auto px-3 py-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative py-6">
                {/* progress track sits between icons: centered with padding so icons align symmetrically */}
                <div className="absolute left-4 right-4 top-1/2 transform -translate-y-1/2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-primary to-indigo-500" style={{ width: `${progressPercent}%`, transition: 'width 400ms ease' }} />
                  </div>
                </div>

                {/* icons row sits above the track; each icon gets equal flex space so they stay symmetric */}
                <div className="relative z-10 flex items-center justify-between overflow-visible mobile-stepbar px-1">
                  {STATUS_SEQUENCE.map((s, i) => {
                    const done = i <= activeIndex;
                    const isActive = i === activeIndex;
                    return (
                      <div key={s} className="flex-1 px-1 relative">
                        {/* icon centered on the track */}
                        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all ${done ? 'bg-primary text-white scale-105' : 'bg-white border border-gray-200 text-gray-500'}`}>
                          <IconFor s={s} />
                        </div>
            {/* label positioned absolutely below the icon to avoid overlap; lifted a bit from bottom */}
            <div style={{ position: 'absolute', top: 'calc(50% + 18px)', left: '50%', transform: 'translateX(-50%)' }} className={`text-[12px] text-center truncate ${isActive ? 'text-primary font-semibold' : 'text-gray-700'}`} title={labelFor(s)}>
              {labelFor(s)}
            </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                    </div>

            {/* small info */}
            <div className="hidden sm:flex flex-col items-end text-right">
              <div className="text-sm font-medium text-gray-700">Order {order?.id}</div>
              <div className="text-xs text-gray-500">{labelFor(order?.status ?? 'placed')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Order Delivered Modal */}
      <Dialog open={showDeliveredModal} onOpenChange={(open) => {
        console.log('Delivery modal onOpenChange:', open, 'Current path:', location.pathname);
        setShowDeliveredModal(open);
      }}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Order Delivered Successfully</DialogTitle>
          </DialogHeader>
          
          {/* Confetti Animation */}
          {showDeliveredModal && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className={`absolute confetti-piece confetti-${i % 8}`}
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${-10 - Math.random() * 20}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${3 + Math.random() * 2}s`,
                    backgroundColor: [
                      '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B',
                      '#EF4444', '#06B6D4', '#84CC16', '#F97316'
                    ][i % 8],
                    width: `${6 + Math.random() * 4}px`,
                    height: `${8 + Math.random() * 6}px`,
                    transform: `rotate(${Math.random() * 360}deg)`
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative z-10 p-8 text-center">
            {/* Success Icon */}
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center animate-scale-in">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>

            {/* Main Message */}
            <h2 className="text-2xl font-bold text-green-600 mb-2 animate-slide-up">
              Woohoo! Your Order was Delivered! 🎉
            </h2>
            <p className="text-gray-600 mb-6 animate-slide-up-delay">
              Enjoy your fresh, delicious chicken! ✨
            </p>

            {/* Order Summary */}
            {order && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Order ID</span>
                  <span className="font-semibold text-gray-800">#{order.id?.slice(0, 8)}</span>
                </div>
                {productName && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600 text-sm">Product</span>
                    <span className="font-semibold text-gray-800">{productName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Weight</span>
                  <span className="font-semibold text-gray-800">{order.weight_kg}kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total Paid</span>
                  <span className="font-bold text-green-600">₹{order.total_amount}</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button 
              onClick={() => {
                setShowDeliveredModal(false);
                navigate('/menu');
              }}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 animate-bounce-in"
            >
              Yay! Thank You! 🎉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modern Order Cancelled Modal */}
      <Dialog open={showCancelledModal} onOpenChange={(open) => setShowCancelledModal(open)}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Order Cancelled</DialogTitle>
          </DialogHeader>

          <div className="relative z-10 p-8 text-center">
            {/* Cancel Icon */}
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center animate-scale-in">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>

            {/* Main Message */}
            <h2 className="text-2xl font-bold text-orange-600 mb-2 animate-slide-up">
              Oh No! Order was Cancelled 😔
            </h2>
            <p className="text-gray-600 mb-6 animate-slide-up-delay">
              We're sorry for any inconvenience caused 💔
            </p>

            {/* Order Summary */}
            {order && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Order ID</span>
                  <span className="font-semibold text-gray-800">#{order.id?.slice(0, 8)}</span>
                </div>
                {productName && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600 text-sm">Product</span>
                    <span className="font-semibold text-gray-800">{productName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Weight</span>
                  <span className="font-semibold text-gray-800">{order.weight_kg}kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Amount</span>
                  <span className="font-bold text-orange-600">₹{order.total_amount}</span>
                </div>
              </div>
            )}

            {/* Support Message */}
            <div className="bg-blue-50 rounded-xl p-4 mb-6 animate-fade-in">
              <p className="text-sm text-blue-700 font-medium mb-1">💬 Need Help?</p>
              <p className="text-xs text-blue-600">
                Contact us on WhatsApp for assistance or to place a new order! 📱
              </p>
            </div>

            {/* Action Button */}
            <Button 
              onClick={() => {
                setShowCancelledModal(false);
                navigate('/menu');
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 animate-bounce-in"
            >
              Got it! 👍
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Small toast removed as requested. */}
    </div>
  );
}
