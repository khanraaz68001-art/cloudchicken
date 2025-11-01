import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getAppSetting } from "@/lib/settings";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { RefreshCw, Volume2, VolumeX } from "lucide-react";
import { useOrderNotification } from "@/hooks/use-order-notification";
import { MessageSquare, Scissors, Package } from "lucide-react";

interface Order {
  id: string;
  user_id: string;
  product_id?: string;
  weight_kg: number;
  quantity: number;
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
    base_price_per_kg: number;
  };
  butchered_meat?: {
    id: string;
    individual_chicken_id: string;
  };
}

interface AvailableChicken {
  id: string;
  weight_kg: number;
  batch_number: string;
  received_date: string;
}

interface Product {
  id: string;
  name: string;
  base_price_per_kg: number;
  product_categories: {
    name: string;
  };
}

const EnhancedKitchenDashboard = () => {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableChickens, setAvailableChickens] = useState<AvailableChicken[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Butchering state
  const [selectedChicken, setSelectedChicken] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [showButcherDialog, setShowButcherDialog] = useState(false);

  // Sound notification state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [previousOrderCount, setPreviousOrderCount] = useState(0);
  const { playNotification, stopNotification, isPlaying } = useOrderNotification({
    enabled: soundEnabled,
    volume: 0.7,
    loop: true
  });

  useEffect(() => {
    if (userProfile?.role === 'kitchen' || userProfile?.role === 'admin') {
      fetchData();
      
      // Set up automatic refresh every 10 seconds for real-time updates
      const intervalId = setInterval(() => {
        fetchData();
      }, 10000);

      // Set up real-time subscription for orders table changes
      const ordersSubscription = supabase
        .channel('orders_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'orders'
          }, 
          () => {
            // Refresh data when orders table changes
            fetchData();
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

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchOrders(),
        fetchAvailableChickens(),
        fetchProducts()
      ]);
    } catch (error: any) {
      setError(error.message);
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        user_profiles!inner (name, whatsapp_number),
        products!inner (id, name, base_price_per_kg)
      `)
  // include 'pending' and 'cancelled' so kitchen can see cancelled records
  .in('status', ['placed','pending', 'accepted', 'confirmed', 'preparing', 'cutting', 'packing', 'ready', 'out_for_delivery', 'cancelled'])
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    const newOrders = data || [];
    
    // Check for new pending orders that need attention
    const pendingOrders = newOrders.filter(order => 
      order.status === 'pending' || order.status === 'placed'
    );
    
    // If we have more pending orders than before, play notification
    if (pendingOrders.length > 0 && soundEnabled && previousOrderCount >= 0) {
      const currentPendingCount = pendingOrders.length;
      const previousPendingOrders = orders.filter(order => 
        order.status === 'pending' || order.status === 'placed'
      );
      
      if (currentPendingCount > previousPendingOrders.length) {
        playNotification();
      }
    }
    
    // Stop notification if no pending orders
    if (pendingOrders.length === 0 && isPlaying()) {
      stopNotification();
    }
    
    setOrders(newOrders);
    setPreviousOrderCount(newOrders.length);
  };

  const fetchAvailableChickens = async () => {
    const { data, error } = await supabase
      .from('individual_chickens')
      .select('*')
      .eq('status', 'available')
      .order('received_date', { ascending: true });

    if (error) throw error;
    setAvailableChickens(data || []);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_available', true)
      .order('name');

    if (error) throw error;
    setProducts(data || []);
  };

  const butcherChicken = async () => {
    if (!selectedChicken) {
      setError("Please select a chicken to butcher");
      return;
    }

    try {
      setLoading(true);

      const targetProductId = (selectedProduct === '' || selectedProduct === '__none') ? null : selectedProduct;

      const { data, error } = await supabase.rpc('butcher_chicken', {
        chicken_id: selectedChicken,
        target_product_id: targetProductId
      });

      if (error) throw error;

      if (data && data[0]?.success) {
        setSuccess(data[0].message);
        setSelectedChicken("");
        setSelectedProduct("");
        setShowButcherDialog(false);
        await fetchData();
      } else {
        setError(data?.[0]?.message || "Failed to butcher chicken");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setSuccess(`Order status updated to ${newStatus.replace('_', ' ')}`);

      // Stop notification sound when order is accepted
      if (newStatus === 'accepted' || newStatus === 'confirmed') {
        // Check if there are any remaining pending orders after this update
        const remainingPendingOrders = orders.filter(order => 
          order.id !== orderId && (order.status === 'pending' || order.status === 'placed')
        );
        
        if (remainingPendingOrders.length === 0) {
          stopNotification();
        }
      }

      // If order delivered, reduce the corresponding butchered_meat weight
      if (newStatus === 'delivered') {
        try {
          const { data: ord, error: ordErr } = await supabase
            .from('orders')
            .select('butchered_meat_id, weight_kg')
            .eq('id', orderId)
            .single();

          if (!ordErr && ord?.butchered_meat_id) {
            const bmId = ord.butchered_meat_id;
            const orderKg = parseFloat(String(ord.weight_kg || 0));

            const { data: bm, error: bmErr } = await supabase
              .from('butchered_meat')
              .select('weight_kg, status')
              .eq('id', bmId)
              .single();

            if (!bmErr && bm) {
              const currentKg = parseFloat(String(bm.weight_kg || 0));
              let newKg = Math.max(0, currentKg - orderKg);
              // If nothing remains, mark as delivered (or trashed depending on business rule)
              const newBmStatus = newKg <= 0 ? 'delivered' : bm.status || 'available';

              const { error: upErr } = await supabase
                .from('butchered_meat')
                .update({ weight_kg: newKg, status: newBmStatus })
                .eq('id', bmId);

              if (upErr) console.warn('Failed to update butchered_meat after delivery', upErr);
            }
          }
        } catch (e) {
          console.warn('Error reducing butchered_meat weight on delivery', e);
        }
      }

      await fetchOrders();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const assignMeatToOrder = async (orderId: string, meatId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('orders')
        .update({ 
          butchered_meat_id: meatId,
          status: 'packing'
        })
        .eq('id', orderId);

      if (error) throw error;

      setSuccess("Meat assigned to order and moved to packing");
      await fetchOrders();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppUpdate = async (order: Order) => {
    const shortId = order.id.slice(0,8);
    const productName = order.products?.name || 'chicken';
    const statusLabel = order.status.replace('_', ' ');

    let supportContact = '+91 XXXXX XXXXX';
    try {
      const s = await getAppSetting('support_whatsapp');
      if (s) supportContact = s;
    } catch (e) {
      console.warn('Failed to load support_whatsapp setting', e);
    }

    let text = '';
    if (order.status === 'out_for_delivery') {
      text = `🎉 Hi ${order.user_profiles.name}!\n\n🚚 Your Cloud Chicken order #${shortId} is out for delivery!\n\n📦 Order Details:\n🍗 ${order.quantity}x ${productName}\n⚖️ ${order.weight_kg}kg\n\n📍 Delivery Address: ${order.delivery_address || 'on file'}\n\n⏰ Our delivery partner will reach shortly — please be available to receive your order!\n\n📞 Need to update delivery instructions? Reply here or call ${supportContact}\n\n🙏 Thanks for choosing Cloud Chicken! ✨`;
    } else if (order.status === 'delivered') {
      text = `🎊 Hi ${order.user_profiles.name}!\n\n✅ Your Cloud Chicken order #${shortId} has been delivered successfully!\n\n📦 Order Summary:\n🍗 ${order.quantity}x ${productName}\n⚖️ ${order.weight_kg}kg\n💰 Total: ₹${order.total_amount}\n\n😋 Hope you're happy with your fresh order!\n\n❓ Any concerns? Reply here or call ${supportContact}\n\n🙏 Thank you for choosing Cloud Chicken! 🌟`;
    } else {
      text = `👋 Hi ${order.user_profiles.name}!\n\n📱 Your Cloud Chicken order #${shortId} is now ${statusLabel}.\n\n📦 Order Details:\n🍗 ${order.quantity}x ${productName}\n⚖️ ${order.weight_kg}kg\n\n⏳ We'll notify you when it moves to the next stage.\n\n🙏 Thanks for choosing Cloud Chicken! ✨`;
    }

    const message = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${order.user_profiles.whatsapp_number}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-blue-100 text-blue-800",
      accepted: "bg-yellow-100 text-yellow-800",
      cutting: "bg-orange-100 text-orange-800",
      confirmed: "bg-amber-100 text-amber-800",
      preparing: "bg-orange-50 text-orange-800",
      ready: "bg-green-50 text-green-800",
      packing: "bg-purple-100 text-purple-800",
      out_for_delivery: "bg-green-100 text-green-800",
      delivered: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (!userProfile || (userProfile.role !== 'kitchen' && userProfile.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert>
            <AlertDescription>Access denied. Kitchen staff privileges required.</AlertDescription>
          </Alert>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Kitchen Dashboard</h1>
              <p className="text-gray-600">Manage orders, butchering, and stock</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={soundEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (!soundEnabled) {
                    // If enabling sound and there are pending orders, start playing
                    const pendingOrders = orders.filter(order => 
                      order.status === 'pending' || order.status === 'placed'
                    );
                    if (pendingOrders.length > 0) {
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
                  🔔 New orders pending!
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="butchering">Butchering</TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <div className="grid gap-4">
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <p className="text-gray-500">No pending orders</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            Order #{order.id.slice(0, 8)}
                          </CardTitle>
                          <CardDescription>
                            {order.user_profiles.name} • {order.user_profiles.whatsapp_number}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Product:</span>
                          <p>{order.products?.name || 'Custom Order'}</p>
                        </div>
                        <div>
                          <span className="font-medium">Quantity:</span>
                          <p>{order.quantity}x ({order.weight_kg}kg)</p>
                        </div>
                        <div>
                          <span className="font-medium">Amount:</span>
                          <p>₹{order.total_amount}</p>
                        </div>
                        <div>
                          <span className="font-medium">Address:</span>
                          <p className="truncate">{order.delivery_address}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {order.status === 'cancelled' ? (
                          <div className="text-sm text-gray-600">Order cancelled — no actions available.</div>
                        ) : (
                          <>
                            {order.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => updateOrderStatus(order.id, 'accepted')}
                                disabled={loading}
                              >
                                Accept Order
                              </Button>
                            )}
                            
                            {order.status === 'accepted' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateOrderStatus(order.id, 'cutting')}
                                disabled={loading}
                              >
                                <Scissors className="h-4 w-4 mr-1" />
                                Start Cutting
                              </Button>
                            )}

                            {order.status === 'cutting' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateOrderStatus(order.id, 'packing')}
                                disabled={loading}
                              >
                                <Package className="h-4 w-4 mr-1" />
                                Mark for Packing
                              </Button>
                            )}
                            
                            {order.status === 'packing' && (
                              <Button
                                size="sm"
                                onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                                disabled={loading}
                              >
                                <Package className="h-4 w-4 mr-1" />
                                Ready for Delivery
                              </Button>
                            )}

                            {order.status === 'ready' && (
                              <Button
                                size="sm"
                                onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                                disabled={loading}
                              >
                                <Package className="h-4 w-4 mr-1" />
                                Mark Out for Delivery
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendWhatsAppUpdate(order)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Send Update
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Butchering Tab */}
          <TabsContent value="butchering" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Butchering Station</h2>
              <Dialog open={showButcherDialog} onOpenChange={setShowButcherDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Scissors className="h-4 w-4 mr-2" />
                    Butcher Chicken
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Butcher Chicken</DialogTitle>
                    <DialogDescription>
                      Select a chicken and the target product to create butchered meat.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Select Chicken</label>
                      <Select value={selectedChicken} onValueChange={setSelectedChicken}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose available chicken" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableChickens.map((chicken) => (
                            <SelectItem key={chicken.id} value={chicken.id}>
                              {chicken.weight_kg}kg - {chicken.batch_number} 
                              (Added: {new Date(chicken.received_date).toLocaleDateString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Target Product</label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose product type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">No product (butcher without assigning)</SelectItem>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - ₹{product.base_price_per_kg}/kg
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={butcherChicken} disabled={loading} className="w-full">
                      <Scissors className="h-4 w-4 mr-2" />
                      Butcher Chicken
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available Chickens */}
              <Card>
                <CardHeader>
                  <CardTitle>Available Chickens</CardTitle>
                  <CardDescription>Ready for butchering</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableChickens.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No chickens available</p>
                    ) : (
                      availableChickens.map((chicken) => (
                        <div
                          key={chicken.id}
                          className="flex items-center justify-between p-3 bg-green-50 rounded-lg border"
                        >
                          <div>
                            <div className="font-medium">{chicken.weight_kg}kg</div>
                            <div className="text-sm text-gray-600">{chicken.batch_number}</div>
                          </div>
                          <div className="text-right text-sm text-gray-600">
                            {new Date(chicken.received_date).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Products */}
              <Card>
                <CardHeader>
                  <CardTitle>Available Products</CardTitle>
                  <CardDescription>Products to butcher into</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border"
                      >
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-600">₹{product.base_price_per_kg}/kg</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">₹{product.base_price_per_kg}/kg</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>


        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default EnhancedKitchenDashboard;