import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  name: string;
  description: string;
  image: string;
  weights: { weight: string; price: number }[];
  category: string;
  deal?: string;
}

export const ProductCard = ({ name, description, image, weights, category, deal }: ProductCardProps) => {
  return (
    <Card className="group overflow-hidden hover:shadow-[var(--shadow-hover)] transition-all duration-300">
      <div className="relative overflow-hidden aspect-square">
        <img 
          src={image} 
          alt={name}
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
        />
        {deal && (
          <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground">
            {deal}
          </Badge>
        )}
        <Badge className="absolute top-3 left-3 bg-secondary text-secondary-foreground">
          {category}
        </Badge>
      </div>
      
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-lg">{name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        
        <div className="space-y-1">
          {weights.map((w, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{w.weight}</span>
              <span className="font-semibold text-primary">₹{w.price}</span>
            </div>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Button className="w-full group/btn" size="sm">
          <ShoppingCart className="mr-2 h-4 w-4 group-hover/btn:scale-110 transition-transform" />
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
};
