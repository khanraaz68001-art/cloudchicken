import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Meta from '@/components/Meta';

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Meta
        title={`About Cloud Chicken — Fresh Chicken Delivery in Dibrugarh`}
        description={`Learn about Cloud Chicken, our mission to deliver fresh chicken quickly, and why customers trust us.`}
        url={`https://cloudchicken.in/about`}
      />
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-4">About Us</h1>
        <p className="text-muted-foreground mb-4">
          Cloud Chicken started with a simple idea: deliver fresh, hygienically prepared chicken quickly to homes and small businesses. We work closely with trusted farms and use temperature-controlled logistics to ensure quality.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          <div>
            <h3 className="font-semibold text-lg mb-2">Our Mission</h3>
            <p className="text-sm text-muted-foreground">Provide fresh, safe and convenient chicken delivery while supporting local farmers and sustainable practices.</p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Why Choose Us</h3>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>Freshness guaranteed</li>
              <li>2-hour delivery in covered zones</li>
              <li>Hygienic processing & packaging</li>
            </ul>
          </div>
        </div>

        <div className="mt-10">
          <Link to="/menu">
            <Button>View Menu</Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
