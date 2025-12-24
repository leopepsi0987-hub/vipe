import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

export default function RefundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logo} alt="VipeAI" className="w-8 h-8" />
            <span className="text-xl font-bold text-primary">VipeAI</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Refund Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Subscription Refunds</h2>
            <p className="text-muted-foreground leading-relaxed">
              We offer a 7-day money-back guarantee for new subscribers. If you are not satisfied with 
              our Service within the first 7 days of your initial subscription, you may request a full 
              refund. This guarantee applies only to first-time subscribers and the initial billing period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Eligibility for Refunds</h2>
            <p className="text-muted-foreground leading-relaxed">
              To be eligible for a refund, you must:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-2">
              <li>Request the refund within 7 days of your initial subscription payment</li>
              <li>Be a first-time subscriber to the paid plan</li>
              <li>Not have previously received a refund for our Service</li>
              <li>Not have violated our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Non-Refundable Items</h2>
            <p className="text-muted-foreground leading-relaxed">
              The following are not eligible for refunds:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-2">
              <li>Subscription renewals after the initial 7-day period</li>
              <li>Partial month/billing period refunds</li>
              <li>Add-on services or one-time purchases</li>
              <li>Accounts terminated for Terms of Service violations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. How to Request a Refund</h2>
            <p className="text-muted-foreground leading-relaxed">
              To request a refund, please contact our support team at{" "}
              <a href="mailto:vipedz@hotmail.com" className="text-primary hover:underline">
                vipedz@hotmail.com
              </a>{" "}
              with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-2">
              <li>Your account email address</li>
              <li>Date of purchase</li>
              <li>Reason for the refund request</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We aim to process refund requests within 5-7 business days. Once approved, the refund will 
              be credited to your original payment method within 5-10 business days, depending on your 
              payment provider.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Cancellation</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may cancel your subscription at any time through your account settings. Upon cancellation, 
              you will continue to have access to the paid features until the end of your current billing 
              period. No refunds will be provided for the remaining time in your billing period after 
              cancellation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Chargebacks</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you believe there has been an error in billing, please contact us before initiating a 
              chargeback with your payment provider. Chargebacks initiated without contacting us first may 
              result in account suspension and additional fees.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about our Refund Policy, please contact us at{" "}
              <a href="mailto:vipedz@hotmail.com" className="text-primary hover:underline">
                vipedz@hotmail.com
              </a>. 
              We're here to help and will do our best to resolve any issues you may have.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 VipeAI. All rights reserved.
            </p>
            <div className="flex gap-6">
              <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </button>
              <button onClick={() => navigate("/terms")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </button>
              <button onClick={() => navigate("/privacy")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
