import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Trash2, AlertTriangle } from "lucide-react";

interface ButcheredMeat {
  id: string;
  weight_kg: number;
  status: string;
  butchered_at: string;
  categories: {
    id: string;
    name: string;
    weight_kg: number;
  };
}

interface TrashRecord {
  id: string;
  weight_kg: number;
  reason: string;
  recorded_at: string;
  butchered_meat: {
    categories: {
      name: string;
    };
  };
}

interface TrashManagementProps {
  className?: string;
}

const TrashManagement: React.FC<TrashManagementProps> = ({ className = "" }) => {
  const { userProfile } = useAuth();
  const [availableMeat, setAvailableMeat] = useState<ButcheredMeat[]>([]);
  const [trashRecords, setTrashRecords] = useState<TrashRecord[]>([]);
  const [trashForm, setTrashForm] = useState({
    butchered_meat_id: "",
    weight_kg: "",
    reason: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userProfile?.role === 'admin' || userProfile?.role === 'kitchen') {
      fetchData();
    }
  }, [userProfile]);

  const fetchData = async () => {
    try {
      // Fetch available butchered meat (not trashed)
      const { data: meatData } = await supabase
        .from('butchered_meat')
        .select(`
          *,
          categories (*)
        `)
        .neq('status', 'trashed')
        .order('butchered_at', { ascending: false });

      // Fetch trash records
      const { data: trashData } = await supabase
        .from('trash_records')
        .select(`
          *,
          butchered_meat (
            categories (name)
          )
        `)
        .order('recorded_at', { ascending: false });

      setAvailableMeat(meatData || []);
      setTrashRecords(trashData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data');
    }
  };

  const handleTrashMeat = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const selectedMeat = availableMeat.find(m => m.id === trashForm.butchered_meat_id);
      const trashWeight = parseFloat(trashForm.weight_kg);
      
      if (!selectedMeat) {
        throw new Error("Please select meat to trash");
      }

      if (trashWeight <= 0 || trashWeight > selectedMeat.weight_kg) {
        throw new Error(`Weight must be between 0 and ${selectedMeat.weight_kg}kg`);
      }

      // Record trash entry
      const { error: trashError } = await supabase
        .from('trash_records')
        .insert({
          butchered_meat_id: trashForm.butchered_meat_id,
          weight_kg: trashWeight,
          reason: trashForm.reason,
          recorded_by: userProfile?.id
        });

      if (trashError) throw trashError;

      // If entire meat piece is trashed, update its status
      if (trashWeight >= selectedMeat.weight_kg) {
        const { error: statusError } = await supabase
          .from('butchered_meat')
          .update({ status: 'trashed' })
          .eq('id', trashForm.butchered_meat_id);

        if (statusError) throw statusError;
      }

      // Reset form
      setTrashForm({
        butchered_meat_id: "",
        weight_kg: "",
        reason: ""
      });

      fetchData();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTotalTrashWeight = () => {
    return trashRecords.reduce((total, record) => total + record.weight_kg, 0);
  };

  if (userProfile?.role !== 'admin' && userProfile?.role !== 'kitchen') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertDescription>Access denied. Admin or kitchen privileges required.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Record Trash */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <CardTitle>Record Waste</CardTitle>
            </div>
            <CardDescription>
              Record waste from butchered meat (bones, unusable parts)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleTrashMeat} className="space-y-4">
              <div>
                <Label htmlFor="meat_select">Select Meat</Label>
                <select
                  id="meat_select"
                  value={trashForm.butchered_meat_id}
                  onChange={(e) => setTrashForm({ ...trashForm, butchered_meat_id: e.target.value })}
                  className="w-full p-2 border rounded mt-1"
                  required
                >
                  <option value="">Select meat to record waste</option>
                  {availableMeat.map((meat) => (
                    <option key={meat.id} value={meat.id}>
                      {meat.categories.name} ({meat.weight_kg}kg) - {meat.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="trash_weight">Waste Weight (kg)</Label>
                <Input
                  id="trash_weight"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={trashForm.weight_kg}
                  onChange={(e) => setTrashForm({ ...trashForm, weight_kg: e.target.value })}
                  placeholder="e.g., 0.5"
                  required
                />
                {trashForm.butchered_meat_id && (
                  <p className="text-sm text-gray-600 mt-1">
                    Max: {availableMeat.find(m => m.id === trashForm.butchered_meat_id)?.weight_kg}kg
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="reason">Reason for Waste</Label>
                <Input
                  id="reason"
                  value={trashForm.reason}
                  onChange={(e) => setTrashForm({ ...trashForm, reason: e.target.value })}
                  placeholder="e.g., bones, unusable parts"
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Recording..." : "Record Waste"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Trash Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Waste Summary</CardTitle>
            <CardDescription>Overview of recorded waste</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <p className="font-medium text-red-800">Total Waste Recorded</p>
                </div>
                <p className="text-2xl font-bold text-red-900 mt-2">
                  {getTotalTrashWeight().toFixed(2)} kg
                </p>
                <p className="text-sm text-red-600">
                  From {trashRecords.length} entries
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Recent Waste Records</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {trashRecords.slice(0, 10).map((record) => (
                    <div key={record.id} className="flex justify-between items-center p-2 border rounded text-sm">
                      <div>
                        <p className="font-medium">{record.butchered_meat.categories.name}</p>
                        <p className="text-gray-600">{record.reason}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(record.recorded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {record.weight_kg}kg
                      </Badge>
                    </div>
                  ))}

                  {trashRecords.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No waste records yet</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Meat for Trash */}
      <Card>
        <CardHeader>
          <CardTitle>Available Meat</CardTitle>
          <CardDescription>Butchered meat that can have waste recorded</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {availableMeat.map((meat) => (
              <div key={meat.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{meat.categories.name}</p>
                  <p className="text-sm text-gray-600">
                    {meat.weight_kg}kg • Butchered: {new Date(meat.butchered_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={
                    meat.status === 'available' ? 'default' :
                    meat.status === 'packed' ? 'secondary' :
                    meat.status === 'delivered' ? 'outline' : 'destructive'
                  }
                >
                  {meat.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            ))}

            {availableMeat.length === 0 && (
              <p className="text-gray-500 text-center py-8">No meat available for waste recording</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrashManagement;