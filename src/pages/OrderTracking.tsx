import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      setOrders(data || []);
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

      // refresh
      await fetchOrders();
      await fetchOrderHistory(orderId);
      // fetch updated selected order
      const { data: updated } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (updated) setSelectedOrder(updated as Order);
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
                            <AlertDialog>
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

      <Footer />
    </div>
  );
};

export default OrderTracking;