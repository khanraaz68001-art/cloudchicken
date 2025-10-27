import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Trash2, Plus, AlertTriangle, BarChart3, Calendar } from "lucide-react";

interface IndividualChicken {
  id: string;
  weight_kg: number;
  status: string;
  batch_number: string;
  received_date: string;
  butchered_date?: string;
}

interface ButcheredMeat {
  id: string;
  individual_chicken_id: string;
  product_id: string;
  weight_kg: number;
  status: string;
  butchered_at: string;
  products?: {
    name: string;
  };
  individual_chickens?: {
    batch_number: string;
    weight_kg: number;
  };
}

interface WasteRecord {
  id: string;
  source_type: string; // 'whole_chicken' or 'butchered_meat'
  source_id: string;
  individual_chicken_id?: string;
  butchered_meat_id?: string;
  waste_weight_kg: number;
  waste_reason: string;
  waste_category: string;
  recorded_at: string;
  recorded_by: string;
  user_profiles?: {
    full_name: string;
  };
  sourceDetails?: {
    batch_number?: string;
    current_weight_kg?: number;
    source?: string;
    product_name?: string;
    weight_kg?: number;
  };
}

interface WasteSummary {
  total_waste_kg: number;
  chicken_waste_kg: number;
  butchered_waste_kg: number;
  waste_percentage: number;
  records_count: number;
}

const EnhancedWasteManagement = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("record");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Waste recording state
  const [availableChickens, setAvailableChickens] = useState<IndividualChicken[]>([]);
  const [availableMeat, setAvailableMeat] = useState<ButcheredMeat[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null);
  
  const [showWasteDialog, setShowWasteDialog] = useState(false);
  const [wasteForm, setWasteForm] = useState({
    source_type: "",
    source_id: "",
    waste_weight_kg: "",
    waste_reason: "",
    waste_category: "spoilage"
  });

  const wasteCategories = [
    { value: "spoilage", label: "Spoilage/Expired" },
    { value: "damage", label: "Physical Damage" },
    { value: "bones", label: "Bones/Unusable Parts" },
    { value: "excess_fat", label: "Excess Fat" },
    { value: "contamination", label: "Contamination" },
    { value: "processing_loss", label: "Processing Loss" },
    { value: "other", label: "Other" }
  ];

  useEffect(() => {
    if (userProfile?.role === 'admin' || userProfile?.role === 'kitchen') {
      fetchAllData();
    }
  }, [userProfile]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAvailableChickens(),
        fetchAvailableMeat(),
        fetchWasteRecords(),
        fetchWasteSummary()
      ]);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
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

  const fetchAvailableMeat = async () => {
    const { data, error } = await supabase
      .from('butchered_meat')
      .select(`
        *,
        products (name),
        individual_chickens (batch_number, weight_kg)
      `)
      // include any butchered_meat entries with remaining weight > 0 regardless of status
      .gt('weight_kg', 0)
      .order('butchered_at', { ascending: true });
    
    if (error) throw error;
    setAvailableMeat(data || []);
  };

  const fetchWasteRecords = async () => {
    try {
      // First, fetch waste records without user join to avoid foreign key issues
      const { data, error } = await supabase
        .from('enhanced_waste_records')
        .select(`
          id,
          source_type,
          source_id,
          individual_chicken_id,
          butchered_meat_id,
          waste_weight_kg,
          waste_reason,
          waste_category,
          recorded_at,
          recorded_by
        `)
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Fetch additional details for each record including user info
      const enrichedRecords = await Promise.all((data || []).map(async (record) => {
        let sourceDetails = {};
        let userDetails = {};
        
        // Get user info
        try {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', record.recorded_by)
            .single();
          userDetails = userData || {};
        } catch (userError) {
          console.warn('Could not fetch user details:', userError);
          userDetails = { full_name: 'Unknown User' };
        }
        
        // Get source details
        if (record.source_type === 'whole_chicken' && record.individual_chicken_id) {
          try {
            const { data: chickenData } = await supabase
              .from('individual_chickens')
              .select('batch_number, current_weight_kg, source')
              .eq('id', record.individual_chicken_id)
              .single();
            sourceDetails = chickenData || {};
          } catch (chickenError) {
            console.warn('Could not fetch chicken details:', chickenError);
            sourceDetails = { batch_number: 'Unknown', current_weight_kg: 0, source: 'Unknown' };
          }
        } else if (record.source_type === 'butchered_meat' && record.butchered_meat_id) {
          try {
            const { data: meatData } = await supabase
              .from('butchered_meat')
              .select('product_name, weight_kg')
              .eq('id', record.butchered_meat_id)
              .single();
            sourceDetails = meatData || {};
          } catch (meatError) {
            console.warn('Could not fetch meat details:', meatError);
            sourceDetails = { product_name: 'Unknown Product', weight_kg: 0 };
          }
        }
        
        return {
          ...record,
          sourceDetails,
          user_profiles: (userDetails as any)?.full_name ? userDetails : { full_name: 'Unknown User' }
        } as WasteRecord;
      }));
      
      setWasteRecords(enrichedRecords);
    } catch (error) {
      console.error('Error fetching waste records:', error);
      setWasteRecords([]); // Set empty array on error
    }
  };

  const fetchWasteSummary = async () => {
    const { data, error } = await supabase.rpc('get_waste_summary');
    if (error) throw error;
    setWasteSummary(data?.[0] || null);
  };

  const recordWaste = async () => {
    if (!wasteForm.source_type || !wasteForm.source_id || !wasteForm.waste_weight_kg || !wasteForm.waste_reason) {
      setError("Please fill all required fields");
      return;
    }

    const wasteWeight = parseFloat(wasteForm.waste_weight_kg);
    if (isNaN(wasteWeight) || wasteWeight <= 0) {
      setError("Please enter a valid waste weight");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.rpc('record_waste', {
        p_source_type: wasteForm.source_type,
        p_source_id: wasteForm.source_id,
        p_waste_weight_kg: wasteWeight,
        p_waste_reason: wasteForm.waste_reason,
        p_recorded_by: userProfile?.id,
        p_waste_category: wasteForm.waste_category
      });

      if (error) throw error;

      setSuccess("Waste recorded successfully");
      setWasteForm({
        source_type: "",
        source_id: "",
        waste_weight_kg: "",
        waste_reason: "",
        waste_category: "spoilage"
      });
      setShowWasteDialog(false);
      await fetchAllData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getSourceItems = () => {
    if (wasteForm.source_type === "whole_chicken") {
      return availableChickens.map(chicken => ({
        id: chicken.id,
        label: `${chicken.weight_kg}kg - ${chicken.batch_number} (${new Date(chicken.received_date).toLocaleDateString()})`
      }));
    } else if (wasteForm.source_type === "butchered_meat") {
      return availableMeat.map(meat => ({
        id: meat.id,
        label: `${meat.products?.name} - ${meat.weight_kg}kg (Batch: ${meat.individual_chickens?.batch_number})`
      }));
    }
    return [];
  };

  const getWasteColor = (category: string) => {
    const colors = {
      spoilage: "bg-red-100 text-red-800",
      damage: "bg-orange-100 text-orange-800", 
      bones: "bg-yellow-100 text-yellow-800",
      excess_fat: "bg-blue-100 text-blue-800",
      contamination: "bg-purple-100 text-purple-800",
      processing_loss: "bg-gray-100 text-gray-800",
      other: "bg-pink-100 text-pink-800"
    };
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'kitchen')) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Alert>
            <AlertDescription>Access denied. Admin or Kitchen staff privileges required.</AlertDescription>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Enhanced Waste Management</h1>
          <p className="text-gray-600">Track waste from both whole chickens and butchered meat</p>
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="record" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Record Waste
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Waste History
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Record Waste Tab */}
          <TabsContent value="record" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Waste</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{wasteSummary?.total_waste_kg || 0}kg</div>
                  <div className="text-sm text-gray-600">{wasteSummary?.records_count || 0} records</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Chicken Waste</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{wasteSummary?.chicken_waste_kg || 0}kg</div>
                  <div className="text-sm text-gray-600">Whole chickens</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Processing Waste</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{wasteSummary?.butchered_waste_kg || 0}kg</div>
                  <div className="text-sm text-gray-600">Butchered meat</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Waste %</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{wasteSummary?.waste_percentage || 0}%</div>
                  <div className="text-sm text-gray-600">Of total inventory</div>
                </CardContent>
              </Card>
            </div>

            {/* Record New Waste */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Record New Waste</CardTitle>
                    <CardDescription>Document waste from chickens or butchered meat</CardDescription>
                  </div>
                  <Dialog open={showWasteDialog} onOpenChange={setShowWasteDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Record Waste
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Record Waste</DialogTitle>
                        <DialogDescription>
                          Select the source and specify waste details
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Source Type</Label>
                          <Select
                            value={wasteForm.source_type}
                            onValueChange={(value) => setWasteForm({ ...wasteForm, source_type: value, source_id: "" })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select source type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="whole_chicken">Whole Chicken</SelectItem>
                              <SelectItem value="butchered_meat">Butchered Meat</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {wasteForm.source_type && (
                          <div>
                            <Label>Select Item</Label>
                            <Select
                              value={wasteForm.source_id}
                              onValueChange={(value) => setWasteForm({ ...wasteForm, source_id: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent>
                                {getSourceItems().map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Waste Weight (kg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="0.5"
                              value={wasteForm.waste_weight_kg}
                              onChange={(e) => setWasteForm({ ...wasteForm, waste_weight_kg: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Category</Label>
                            <Select
                              value={wasteForm.waste_category}
                              onValueChange={(value) => setWasteForm({ ...wasteForm, waste_category: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {wasteCategories.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label>Waste Reason</Label>
                          <Textarea
                            placeholder="Describe the reason for waste..."
                            value={wasteForm.waste_reason}
                            onChange={(e) => setWasteForm({ ...wasteForm, waste_reason: e.target.value })}
                          />
                        </div>

                        <Button onClick={recordWaste} disabled={loading} className="w-full">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Record Waste
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-3">Available Chickens</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableChickens.length === 0 ? (
                        <p className="text-gray-500 text-sm">No chickens available</p>
                      ) : (
                        availableChickens.map((chicken) => (
                          <div key={chicken.id} className="p-2 bg-gray-50 rounded border">
                            <div className="font-medium">{chicken.weight_kg}kg</div>
                            <div className="text-sm text-gray-600">{chicken.batch_number}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Available Butchered Meat</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableMeat.length === 0 ? (
                        <p className="text-gray-500 text-sm">No butchered meat available</p>
                      ) : (
                        availableMeat.map((meat) => (
                          <div key={meat.id} className="p-2 bg-gray-50 rounded border">
                            <div className="font-medium">{meat.products?.name}</div>
                            <div className="text-sm text-gray-600">{meat.weight_kg}kg</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Waste History Tab */}
          <TabsContent value="history" className="space-y-4">
            <div className="grid gap-4">
              {wasteRecords.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <p className="text-gray-500">No waste records found</p>
                  </CardContent>
                </Card>
              ) : (
                wasteRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={getWasteColor(record.waste_category)}>
                              {wasteCategories.find(c => c.value === record.waste_category)?.label}
                            </Badge>
                            <Badge variant="outline">
                              {record.source_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Weight:</span>
                              <p className="text-red-600 font-bold">{record.waste_weight_kg}kg wasted</p>
                            </div>
                            <div>
                              <span className="font-medium">Source:</span>
                              <p>
                                {record.source_type === 'whole_chicken' 
                                  ? `${record.sourceDetails?.batch_number} (${record.sourceDetails?.current_weight_kg}kg)`
                                  : record.sourceDetails?.product_name
                                }
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Recorded by:</span>
                              <p>{record.user_profiles?.full_name || 'Unknown User'}</p>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <span className="font-medium text-sm">Reason:</span>
                            <p className="text-sm text-gray-700">{record.waste_reason}</p>
                          </div>
                        </div>
                        
                        <div className="text-right text-sm text-gray-600">
                          {new Date(record.recorded_at).toLocaleDateString()}
                          <br />
                          {new Date(record.recorded_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Waste by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {wasteCategories.map((category) => {
                      const categoryRecords = wasteRecords.filter(r => r.waste_category === category.value);
                      const totalWeight = categoryRecords.reduce((sum, r) => sum + r.waste_weight_kg, 0);
                      const percentage = wasteSummary?.total_waste_kg ? (totalWeight / wasteSummary.total_waste_kg * 100) : 0;
                      
                      return (
                        <div key={category.value} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Badge className={getWasteColor(category.value)}>
                              {category.label}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{totalWeight.toFixed(1)}kg</div>
                            <div className="text-sm text-gray-600">{percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Waste Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Today's Waste</span>
                      <span className="font-bold">
                        {wasteRecords
                          .filter(r => new Date(r.recorded_at).toDateString() === new Date().toDateString())
                          .reduce((sum, r) => sum + r.waste_weight_kg, 0)
                          .toFixed(1)}kg
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>This Week's Waste</span>
                      <span className="font-bold">
                        {wasteRecords
                          .filter(r => {
                            const weekAgo = new Date();
                            weekAgo.setDate(weekAgo.getDate() - 7);
                            return new Date(r.recorded_at) >= weekAgo;
                          })
                          .reduce((sum, r) => sum + r.waste_weight_kg, 0)
                          .toFixed(1)}kg
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200">
                      <span>Overall Waste Rate</span>
                      <span className="font-bold text-red-600">{wasteSummary?.waste_percentage || 0}%</span>
                    </div>
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

export default EnhancedWasteManagement;