import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Meta from '@/components/Meta';

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Meta
        title={`Terms of Service — Cloud Chicken`}
        description={`Terms of service for using Cloud Chicken's website and ordering platform.`}
        url={`https://cloudchicken.in/terms`}
      />
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-4">
          These Terms of Service govern your use of Cloud Chicken. By using our website and services you agree to these terms.
        </p>

        <section className="mt-6">
          <h3 className="font-semibold mb-2">Ordering</h3>
          <p className="text-sm text-muted-foreground">Orders are subject to availability and acceptance. We reserve the right to cancel or refuse any order.</p>
        </section>

        <section className="mt-6">
          <h3 className="font-semibold mb-2">Liability</h3>
          <p className="text-sm text-muted-foreground">To the fullest extent permitted by law, Cloud Chicken is not liable for indirect or consequential losses arising from the use of our service.</p>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
