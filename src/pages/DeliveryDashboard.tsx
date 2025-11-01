import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getAppSetting, incrementMetric } from "@/lib/settings";
import { formatForWhatsAppURL } from "@/lib/whatsapp";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Phone, Package } from "lucide-react";

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
  const navigate = useNavigate();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [deliveredOrder, setDeliveredOrder] = useState<DeliveryOrder | null>(null);
  const [pendingDeliveryOrder, setPendingDeliveryOrder] = useState<DeliveryOrder | null>(null);

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
      setOrders(newOrders);
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

      // Increment happy customer counter in database
      await incrementMetric('happy_customers');

      // Dispatch order_delivered event to update happy customer counter on homepage
      window.dispatchEvent(new CustomEvent('order_delivered', { 
        detail: { orderId } 
      }));

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
      text = `👋 Hi ${order.user_profiles.name}!\n\n🚚 This is your Cloud Chicken delivery partner for order #${shortId}!\n\n📦 Order Details:\n🍗 ${productName}\n⚖️ ${order.weight_kg}kg\n💰 ₹${order.total_amount}\n\n📍 Delivery Address: ${order.delivery_address}\n\n⏰ I'm on my way and expect to arrive within ~20-40 minutes.\n\n📞 Special drop-off instructions? Reply here or call ${support}\n\n🙏 Thank you for choosing Cloud Chicken! ✨`;
    } else {
      text = `🎊 Hi ${order.user_profiles.name}!\n\n✅ Great news — your Cloud Chicken order #${shortId} has been delivered successfully!\n\n📦 Order Summary:\n🍗 ${productName}\n⚖️ ${order.weight_kg}kg\n💰 Total: ₹${order.total_amount}\n\n😋 We hope everything is perfect!\n\n❓ Any issues? Reply here or call ${support} and we'll make it right.\n\n🙏 Thanks for choosing Cloud Chicken! 🌟`;
    }

    const message = encodeURIComponent(text);
    const formattedNumber = formatForWhatsAppURL(order.user_profiles.whatsapp_number);
    const whatsappUrl = `https://wa.me/${formattedNumber}?text=${message}`;
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

      {/* Delivery Options Dialog */}
        <Dialog open={!!pendingDeliveryOrder} onOpenChange={(open) => { if (!open) setPendingDeliveryOrder(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mark Order as Delivered</DialogTitle>
              <DialogDescription>
                Choose how you want to mark this order as delivered
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Order #{pendingDeliveryOrder?.id?.slice(0,8)}</p>
                <p className="text-xs text-blue-600">Customer: {pendingDeliveryOrder?.user_profiles?.name} • {pendingDeliveryOrder?.user_profiles?.whatsapp_number}</p>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={async () => {
                    if (!pendingDeliveryOrder) return;
                    try {
                      setLoading(true);
                      // Send WhatsApp message first
                      await sendWhatsAppMessage(pendingDeliveryOrder, 'delivered');
                      // Brief delay for WhatsApp to open
                      setTimeout(async () => {
                        await markAsDelivered(pendingDeliveryOrder.id, pendingDeliveryOrder.butchered_meat?.id);
                        // Show celebration popup
                        setDeliveredOrder(pendingDeliveryOrder);
                        setShowCelebration(true);
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
                  {loading ? 'Processing...' : 'Send WhatsApp & Mark Delivered'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    if (!pendingDeliveryOrder) return;
                    try {
                      setLoading(true);
                      await markAsDelivered(pendingDeliveryOrder.id, pendingDeliveryOrder.butchered_meat?.id);
                      // Show celebration popup
                      setDeliveredOrder(pendingDeliveryOrder);
                      setShowCelebration(true);
                      setPendingDeliveryOrder(null);
                    } catch (e) {
                      console.warn('Error marking delivered', e);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Mark Delivered (No Message)'}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setPendingDeliveryOrder(null)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modern Delivery Success Popup */}
      <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Delivery Completed Successfully</DialogTitle>
            <DialogDescription>Order has been marked as delivered with celebration</DialogDescription>
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
              Woohoo! Order was delivered! 🎉
            </h2>
            <p className="text-gray-600 mb-6 animate-slide-up-delay">
              Another happy customer served fresh and fast ✨
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
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Amount</span>
                  <span className="font-bold text-green-600">₹{deliveredOrder.total_amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Customer</span>
                  <span className="font-semibold text-gray-800">{deliveredOrder.user_profiles?.name}</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button 
              onClick={() => {
                setShowCelebration(false);
                setDeliveredOrder(null);
                navigate('/menu');
              }}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 animate-bounce-in"
            >
              Awesome! 🎉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />

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
    </div>
  );
};

export default DeliveryDashboard;