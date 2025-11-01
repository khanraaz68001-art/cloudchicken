import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CheckCircle, Clock, Truck, Package, ChefHat } from "lucide-react";

interface Order {
  id: string;
  weight_kg: number;
  total_amount: number;
  status: string;
  delivery_address: string;
  created_at: string;
  products?: {
    id: string;
    name: string;
    product_categories: {
      name: string;
    };
  };
  butchered_meat?: {
    id: string;
    weight_kg: number;
  };
}

interface OrderStatusHistory {
  id: string;
  status: string;
  created_at: string;
  notes?: string;
}

const getStatusInfo = (status: string) => {
  switch (status) {
    case 'placed':
      return { 
        icon: Clock, 
        color: 'bg-yellow-500', 
        text: 'Order Placed',
        description: 'We have received your order'
      };
    case 'accepted':
      return { 
        icon: CheckCircle, 
        color: 'bg-green-500', 
        text: 'Order Accepted',
        description: 'Your order has been accepted and is being prepared'
      };
    case 'cutting':
      return { 
        icon: ChefHat, 
        color: 'bg-blue-500', 
        text: 'In Cutting Process',
        description: 'Your chicken is being processed and cut'
      };
    case 'packing':
      return { 
        icon: Package, 
        color: 'bg-purple-500', 
        text: 'Being Packed',
        description: 'Your order is being packed for delivery'
      };
    case 'out_for_delivery':
      return { 
        icon: Truck, 
        color: 'bg-orange-500', 
        text: 'Out for Delivery',
        description: 'Your order is on the way'
      };
    case 'delivered':
      return { 
        icon: CheckCircle, 
        color: 'bg-green-600', 
        text: 'Delivered',
        description: 'Your order has been delivered successfully'
      };
    default:
      return { 
        icon: Clock, 
        color: 'bg-gray-500', 
        text: status,
        description: ''
      };
  }
};

const OrderTracking = () => {
  const { user, userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [deliveredOrder, setDeliveredOrder] = useState<Order | null>(null);
  const [previousOrderStatuses, setPreviousOrderStatuses] = useState<Map<string, string>>(new Map());
  const [cancelDialogOpen, setCancelDialogOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // Set up automatic refresh every 15 seconds for user's order tracking
      const intervalId = setInterval(() => {
        fetchOrders();
      }, 15000);

      // Set up real-time subscription for orders table changes
      const ordersSubscription = supabase
        .channel('user_orders_tracking')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          }, 
          () => {
            // Refresh user's orders when their orders change
            fetchOrders();
          }
        )
        .subscribe();

      // Cleanup function
      return () => {
        clearInterval(intervalId);
        supabase.removeChannel(ordersSubscription);
      };
    }
  }, [user]);

  // Force close modal when order is cancelled
  useEffect(() => {
    const handleOrderCancelled = (event: CustomEvent) => {
      const cancelledOrderId = event.detail?.orderId;
      // If the currently viewed order is the one that was cancelled, close the modal
      if (selectedOrder?.id === cancelledOrderId) {
        setModalOpen(false);
        setSelectedOrder(null);
      }
    };

    window.addEventListener('order_cancelled', handleOrderCancelled as EventListener);
    
    return () => {
      window.removeEventListener('order_cancelled', handleOrderCancelled as EventListener);
    };
  }, [selectedOrder?.id]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products (
            id,
            name,
            product_categories (name)
          ),
          butchered_meat (
            id,
            weight_kg
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const newOrders = data || [];
      
      // Check for newly delivered orders to show celebration
      newOrders.forEach(order => {
        const previousStatus = previousOrderStatuses.get(order.id);
        if (previousStatus && previousStatus !== 'delivered' && order.status === 'delivered') {
          // Order just got delivered! Show celebration
          setDeliveredOrder(order);
          setShowCelebration(true);
        }
      });
      
      // Update previous statuses for next comparison
      const newStatusMap = new Map();
      newOrders.forEach(order => {
        newStatusMap.set(order.id, order.status);
      });
      setPreviousOrderStatuses(newStatusMap);
      
      setOrders(newOrders);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderHistory = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderHistory(data || []);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const cancelOrder = async (orderId: string) => {
    // Close the cancel dialog immediately
    setCancelDialogOpen(prev => ({ ...prev, [orderId]: false }));
    
    // Close the order details modal if it's open for this order
    if (selectedOrder?.id === orderId) {
      setModalOpen(false);
      setSelectedOrder(null);
    }
    
    try {
      setLoading(true);
      // re-check status to prevent cancelling if it's out for delivery
      const { data: ord, error: ordErr } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
      if (ordErr) throw ordErr;
      if (ord?.status === 'out_for_delivery') {
        setError('Order is already out for delivery and cannot be cancelled.');
        return;
      }

      const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
      if (error) throw error;

      // Record status history
      try {
        await supabase.from('order_status_history').insert({ order_id: orderId, status: 'cancelled', notes: 'Cancelled by customer' });
      } catch (e) {
        // non-fatal
        console.warn('Failed to insert order_status_history for cancelled order', e);
      }

      // notify listeners
      try { window.dispatchEvent(new CustomEvent('order_cancelled', { detail: { orderId } })); } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('order_modal_close')); } catch (e) {}

      // refresh orders list
      await fetchOrders();
    } catch (e: any) {
      setError(e.message || 'Failed to cancel order');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (order: Order) => {
    // open a modal with order details instead of showing details on the page
    setSelectedOrder(order);
    fetchOrderHistory(order.id);
    setModalOpen(true);
    try { window.dispatchEvent(new CustomEvent('order_modal_open', { detail: { orderId: order.id } })); } catch (e) {}
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Alert>
            <AlertDescription>Please login to view your orders.</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-600">Track your chicken delivery orders</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Orders List */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Orders</h2>
            <div className="space-y-4">
              {loading ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">Loading orders...</p>
                  </CardContent>
                </Card>
              ) : orders.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No orders found</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => {
                  const statusInfo = getStatusInfo(order.status);
                  const IconComponent = statusInfo.icon;
                  
                  return (
                    <Card 
                      key={order.id} 
                      className={`cursor-pointer hover:shadow-md transition-all ${
                        selectedOrder?.id === order.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleOrderClick(order)}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">
                              Order #{order.id.slice(0, 8)}
                            </CardTitle>
                            <CardDescription>
                              {new Date(order.created_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusInfo.color}`} />
                            {statusInfo.text}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Weight:</span>
                            <span className="font-medium">{order.weight_kg}kg</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Amount:</span>
                            <span className="font-medium">₹{order.total_amount}</span>
                          </div>
                          {order.products && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Product:</span>
                              <span className="font-medium text-sm">
                                {order.products.name}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Per-order controls (Cancel) placed on the card for eligible orders */}
                        <div className="flex justify-end pt-3">
                          {order.status !== 'out_for_delivery' && order.status !== 'cancelled' && order.status !== 'delivered' && (
                            <AlertDialog 
                              open={cancelDialogOpen[order.id] || false} 
                              onOpenChange={(open) => setCancelDialogOpen(prev => ({ ...prev, [order.id]: open }))}
                            >
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); }}>Cancel Order</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                                  <AlertDialogDescription>Do you really wish to cancel this order? This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="flex justify-end gap-2">
                                  <AlertDialogCancel onClick={(e: any) => { e?.stopPropagation?.(); }}>No, keep order</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => cancelOrder(order.id)}>Yes, cancel order</AlertDialogAction>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Order Details & Status Timeline */}
          <div>
            {/* Details are shown in a modal now; keep a lightweight placeholder */}
            <div className="bg-white border rounded p-6 text-center text-gray-500">Click on above orders to view details</div>
          </div>

          {/* Order details modal */}
          <Dialog open={modalOpen} onOpenChange={(o) => {
            setModalOpen(o);
            if (!o) {
              setSelectedOrder(null); // Clear selected order when modal closes
              try { window.dispatchEvent(new CustomEvent('order_modal_close')); } catch (e) {}
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Order Details</DialogTitle>
              </DialogHeader>
              {selectedOrder ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">Order #{selectedOrder.id.slice(0,8)} - {new Date(selectedOrder.created_at).toLocaleString()}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">Weight</p>
                      <p className="font-semibold">{selectedOrder.weight_kg}kg</p>
                    </div>
                    <div>
                      <p className="font-medium">Total Amount</p>
                      <p className="font-semibold">₹{selectedOrder.total_amount}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Delivery Address</p>
                    <p className="text-sm">{selectedOrder.delivery_address}</p>
                  </div>
                  {selectedOrder.products && (
                    <div>
                      <p className="font-medium">Product</p>
                      <p className="text-sm">{selectedOrder.products.name} ({selectedOrder.weight_kg}kg) - {selectedOrder.products.product_categories.name}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">Order Status Timeline</h3>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full ${getStatusInfo(selectedOrder.status).color} flex items-center justify-center text-white`}>
                          {React.createElement(getStatusInfo(selectedOrder.status).icon, { size: 16 })}
                        </div>
                        <div>
                          <p className="font-medium">{getStatusInfo(selectedOrder.status).text}</p>
                          <p className="text-sm text-gray-600">{getStatusInfo(selectedOrder.status).description}</p>
                        </div>
                      </div>
                      {orderHistory.map((h) => (
                        <div key={h.id} className="flex items-start gap-3 opacity-60">
                          <div className={`w-8 h-8 rounded-full ${getStatusInfo(h.status).color} flex items-center justify-center text-white`}>{React.createElement(getStatusInfo(h.status).icon, { size: 16 })}</div>
                          <div>
                            <p className="font-medium">{getStatusInfo(h.status).text}</p>
                            <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleString()}</p>
                            {h.notes && <p className="text-xs text-gray-500">{h.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : <div>No order selected</div>}
            </DialogContent>
          </Dialog>
        </div>
      </main>

      {/* 🎉 Delivery Celebration Popup for Customers */}
      <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Order Delivered Successfully</DialogTitle>
            <DialogDescription>Your order has been delivered and you can track future orders</DialogDescription>
          </DialogHeader>
          {/* Confetti Animation */}
          {showCelebration && (
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
            {deliveredOrder && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Product</span>
                  <span className="font-semibold text-gray-800">{deliveredOrder.products?.name || 'Fresh Chicken'}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Weight</span>
                  <span className="font-semibold text-gray-800">{deliveredOrder.weight_kg}kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total Paid</span>
                  <span className="font-bold text-green-600">₹{deliveredOrder.total_amount}</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button 
              onClick={() => {
                setShowCelebration(false);
                setDeliveredOrder(null);
              }}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 animate-bounce-in"
            >
              Yay! Thank You! 🎉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modern Animation Styles */}
      <style>{`
        .confetti-piece {
          border-radius: 2px;
          opacity: 0.8;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes confetti-sway {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(10px); }
        }

        @keyframes scale-in {
          0% { transform: scale(0) rotate(-180deg); }
          100% { transform: scale(1) rotate(0deg); }
        }

        @keyframes slide-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes slide-up-delay {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes fade-in {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes bounce-in {
          0% { transform: scale(0.8); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        .animate-scale-in { animation: scale-in 0.6s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s ease-out 0.1s both; }
        .animate-slide-up-delay { animation: slide-up-delay 0.5s ease-out 0.2s both; }
        .animate-fade-in { animation: fade-in 0.5s ease-out 0.3s both; }
        .animate-bounce-in { animation: bounce-in 0.5s ease-out 0.4s both; }

        .confetti-0 { animation: confetti-fall 4s ease-out, confetti-sway 2s ease-in-out infinite; }
        .confetti-1 { animation: confetti-fall 3.5s ease-out, confetti-sway 2.2s ease-in-out infinite; }
        .confetti-2 { animation: confetti-fall 4.5s ease-out, confetti-sway 1.8s ease-in-out infinite; }
        .confetti-3 { animation: confetti-fall 3s ease-out, confetti-sway 2.5s ease-in-out infinite; }
        .confetti-4 { animation: confetti-fall 5s ease-out, confetti-sway 1.9s ease-in-out infinite; }
        .confetti-5 { animation: confetti-fall 3.8s ease-out, confetti-sway 2.1s ease-in-out infinite; }
        .confetti-6 { animation: confetti-fall 4.2s ease-out, confetti-sway 2.3s ease-in-out infinite; }
        .confetti-7 { animation: confetti-fall 3.3s ease-out, confetti-sway 2.4s ease-in-out infinite; }
      `}</style>

      <Footer />
    </div>
  );
};

export default OrderTracking;