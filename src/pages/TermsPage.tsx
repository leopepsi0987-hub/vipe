import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using VipeAI ("the Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use the Service. We reserve the right to modify 
              these terms at any time, and your continued use of the Service constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              VipeAI is an AI-powered application development platform that allows users to create, edit, 
              and deploy web applications. The Service includes AI assistance, code generation, project hosting, 
              and related features as described on our website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              To use certain features of the Service, you must create an account. You are responsible for 
              maintaining the confidentiality of your account credentials and for all activities that occur 
              under your account. You must provide accurate and complete information when creating your account 
              and keep this information up to date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Subscription and Payment</h2>
            <p className="text-muted-foreground leading-relaxed">
              Some features of the Service require a paid subscription. By subscribing, you agree to pay all 
              applicable fees. Subscriptions are billed on a recurring basis (monthly or annually) and will 
              automatically renew unless cancelled. Prices are subject to change with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of any content you create using the Service. However, you grant VipeAI 
              a license to host, store, and display your content as necessary to provide the Service. The 
              Service itself, including its code, design, and branding, remains the property of VipeAI.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to use the Service for any illegal purposes, to create harmful or malicious 
              applications, to infringe on others' intellectual property rights, or to attempt to compromise 
              the security of the Service. We reserve the right to terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind. VipeAI shall not be liable 
              for any indirect, incidental, special, or consequential damages arising from your use of the 
              Service. Our total liability shall not exceed the amount you paid for the Service in the 
              preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws. Any disputes 
              arising from these Terms or the Service shall be resolved through binding arbitration or in 
              the courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a href="mailto:vipedz@hotmail.com" className="text-primary hover:underline">
                vipedz@hotmail.com
              </a>.
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
              <button onClick={() => navigate("/privacy")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </button>
              <button onClick={() => navigate("/refund")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Refund Policy
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
