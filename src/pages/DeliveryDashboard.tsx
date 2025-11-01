import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getAppSetting } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Phone, Package, Volume2, VolumeX } from "lucide-react";
import { useOrderNotification } from "@/hooks/use-order-notification";

interface DeliveryOrder {
  id: string;
  user_id: string;
  weight_kg: number;
  total_amount: number;
  status: string;
  delivery_address: string;
  created_at: string;
  user_profiles: {
    name: string;
    whatsapp_number: string;
  };
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

const DeliveryDashboard = () => {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [pendingDeliveryOrder, setPendingDeliveryOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sound notification state for new delivery assignments
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [previousOrderCount, setPreviousOrderCount] = useState(0);
  const { playNotification, stopNotification, isPlaying } = useOrderNotification({
    enabled: soundEnabled,
    volume: 0.7,
    loop: true
  });

  useEffect(() => {
    if (userProfile?.role === 'delivery' || userProfile?.role === 'admin') {
      fetchDeliveryOrders();
      
      // Set up automatic refresh every 10 seconds for real-time updates
      const intervalId = setInterval(() => {
        fetchDeliveryOrders();
      }, 10000);

      // Set up real-time subscription for orders table changes
      const ordersSubscription = supabase
        .channel('orders_changes_delivery')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'orders'
          }, 
          () => {
            // Refresh data when orders table changes
            fetchDeliveryOrders();
          }
        )
        .subscribe();

      // Cleanup function
      return () => {
        clearInterval(intervalId);
        supabase.removeChannel(ordersSubscription);
      };
    }
  }, [userProfile]);

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user_profiles (name, whatsapp_number),
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
        .in('status', ['out_for_delivery'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const newOrders = data || [];
      
      // Check for new delivery orders
      if (newOrders.length > 0 && soundEnabled && previousOrderCount >= 0) {
        const currentOrderCount = newOrders.length;
        
        // Play notification if we have more orders than before
        if (currentOrderCount > orders.length) {
          playNotification();
        }
      }
      
      // Stop notification if no orders
      if (newOrders.length === 0 && isPlaying()) {
        stopNotification();
      }
      
      setOrders(newOrders);
      setPreviousOrderCount(newOrders.length);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsDelivered = async (orderId: string, meatId: string | undefined) => {
    setLoading(true);
    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // Update meat status if available
      if (meatId) {
        const { error: meatError } = await supabase
          .from('butchered_meat')
          .update({ status: 'delivered' })
          .eq('id', meatId);

        if (meatError) throw meatError;
      }

      // Stop notification sound when order is delivered
      const remainingOrders = orders.filter(order => order.id !== orderId);
      if (remainingOrders.length === 0) {
        stopNotification();
      }

      fetchDeliveryOrders();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const callCustomer = (phoneNumber: string) => {
    window.open(`tel:${phoneNumber}`, '_self');
  };

  const sendWhatsAppMessage = async (order: DeliveryOrder, type: 'out_for_delivery' | 'delivered' = 'out_for_delivery') => {
    const shortId = order.id.slice(0,8);
    const productName = order.products?.name || 'chicken';

    let support = ' +91 XXXXX XXXXX';
    try {
      const s = await getAppSetting('support_whatsapp');
      if (s) support = s;
    } catch (e) {
      console.warn('Failed to read support_whatsapp setting', e);
    }

    let text = '';
    if (type === 'out_for_delivery') {
      text = `Hi ${order.user_profiles.name},\n\nThis is your Cloud Chicken delivery partner for order #${shortId} (${productName}, ${order.weight_kg}kg, ₹${order.total_amount}). I'm on my way and expect to arrive within ~20-40 minutes.\n\nDelivery address: ${order.delivery_address}\n\nIf you have any special drop-off instructions, please reply here or call ${support}. Thank you!`;
    } else {
      text = `Hi ${order.user_profiles.name},\n\nGood news — your Cloud Chicken order #${shortId} (${productName}, ${order.weight_kg}kg) has been delivered. Total: ₹${order.total_amount}.\n\nWe hope everything is perfect — if there are any issues please reply to this message or call ${support}.\n\nThanks for choosing Cloud Chicken!`;
    }

    const message = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${order.user_profiles.whatsapp_number}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const openMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(mapsUrl, '_blank');
  };

  if (userProfile?.role !== 'delivery' && userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Alert variant="destructive">
            <AlertDescription>Access denied. Delivery partner privileges required.</AlertDescription>
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
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Delivery Dashboard</h1>
              <p className="text-gray-600">Manage deliveries and mark orders as completed</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={soundEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) {
                    // If enabling sound and there are delivery orders, start playing
                    if (orders.length > 0) {
                      playNotification();
                    }
                  } else {
                    // If disabling sound, stop playing
                    stopNotification();
                  }
                }}
                className={`flex items-center gap-2 ${isPlaying() && soundEnabled ? 'animate-pulse bg-orange-500 hover:bg-orange-600' : ''}`}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {soundEnabled ? (isPlaying() ? 'Bell Ringing' : 'Sound On') : 'Sound Off'}
              </Button>
              {isPlaying() && soundEnabled && (
                <div className="text-sm text-orange-600 font-medium">
                  🚚 New deliveries ready!
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          {loading ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">Loading delivery orders...</p>
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No deliveries pending</p>
                <p className="text-sm text-gray-400">Check back later for new delivery assignments</p>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-green-500">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">
                        Order #{order.id.slice(0, 8)}
                      </CardTitle>
                      <CardDescription>
                        Customer: {order.user_profiles.name} • {order.user_profiles.whatsapp_number}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      OUT FOR DELIVERY
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Order Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Weight</p>
                        <p className="text-2xl font-bold">{order.weight_kg}kg</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Amount</p>
                        <p className="text-2xl font-bold">₹{order.total_amount}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-gray-600">Order Time</p>
                        <p className="text-sm font-semibold">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Meat Assignment */}
                    {order.products && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-800">Product</p>
                        <p className="text-lg font-semibold text-blue-900">
                          {order.products.name}
                        </p>
                        <p className="text-sm text-blue-700">
                          {order.products.product_categories.name} • {order.weight_kg}kg
                        </p>
                      </div>
                    )}

                    {/* Delivery Address */}
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-orange-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-800">Delivery Address</p>
                          <p className="text-orange-900 mt-1">{order.delivery_address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => callCustomer(order.user_profiles.whatsapp_number)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4" />
                        Call Customer
                      </Button>

                      <Button
                        onClick={() => sendWhatsAppMessage(order)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Package className="h-4 w-4" />
                        WhatsApp Update
                      </Button>

                      <Button
                        onClick={() => openMaps(order.delivery_address)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <MapPin className="h-4 w-4" />
                        Open in Maps
                      </Button>

                      <Button
                        onClick={() => setPendingDeliveryOrder(order)}
                        disabled={loading}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <Package className="h-4 w-4" />
                        {loading ? "Processing..." : "Mark as Delivered"}
                      </Button>
                    </div>

                    {/* Delivery Instructions */}
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <p className="text-sm font-medium text-yellow-800">Delivery Instructions</p>
                      <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                        <li>• Verify customer identity before delivery</li>
                        <li>• Ensure product quality and packaging</li>
                        <li>• Collect payment if cash on delivery</li>
                        <li>• Get delivery confirmation from customer</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Confirm/Send dialog when marking delivered (responsive & symmetric) */}
      <Dialog open={!!pendingDeliveryOrder} onOpenChange={(open) => { if (!open) setPendingDeliveryOrder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Order Delivered</DialogTitle>
          </DialogHeader>

          <div className="text-sm text-gray-700 mt-2">
            <p>Would you like to send a WhatsApp update to the customer before marking this order as delivered?</p>
            <div className="mt-3">
              <p className="font-medium">Order #{pendingDeliveryOrder?.id?.slice(0,8)}</p>
              <p className="text-xs text-gray-500">Customer: {pendingDeliveryOrder?.user_profiles?.name} • {pendingDeliveryOrder?.user_profiles?.whatsapp_number}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <Button variant="outline" className="w-full" onClick={() => setPendingDeliveryOrder(null)} disabled={loading}>Cancel</Button>
            </div>

            <div className="sm:col-span-1">
              <Button
                className="w-full"
                onClick={async () => {
                  if (!pendingDeliveryOrder) return;
                  try {
                    setLoading(true);
                    // send a DELIVERED template when delivery is marking delivered with update
                    await sendWhatsAppMessage(pendingDeliveryOrder, 'delivered');
                    // give the user a brief moment after opening WhatsApp
                    setTimeout(async () => {
                      await markAsDelivered(pendingDeliveryOrder.id, pendingDeliveryOrder.butchered_meat?.id);
                      setPendingDeliveryOrder(null);
                    }, 800);
                  } catch (e) {
                    console.warn('Error during send & mark delivered', e);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Send & Mark Delivered'}
              </Button>
            </div>

            <div className="sm:col-span-1">
              <Button
                variant="destructive"
                className="w-full"
                onClick={async () => {
                  if (!pendingDeliveryOrder) return;
                  try {
                    setLoading(true);
                    await markAsDelivered(pendingDeliveryOrder.id, pendingDeliveryOrder.butchered_meat?.id);
                    setPendingDeliveryOrder(null);
                  } catch (e) {
                    console.warn('Error marking delivered', e);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Mark Delivered (no message)'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default DeliveryDashboard;