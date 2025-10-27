import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const Privacy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-4">
          This Privacy Policy describes how Cloud Chicken collects, uses, and shares your personal information. We only use personal data to provide and improve our services, to process orders, and to communicate with customers.
        </p>

        <section className="mt-6">
          <h3 className="font-semibold mb-2">Information We Collect</h3>
          <p className="text-sm text-muted-foreground">Name, contact details, delivery address, and order history necessary to fulfill orders.</p>
        </section>

        <section className="mt-6">
          <h3 className="font-semibold mb-2">How We Use Data</h3>
          <p className="text-sm text-muted-foreground">We use your information to process orders, send transactional messages, and improve our service. We do not sell your personal data.</p>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
