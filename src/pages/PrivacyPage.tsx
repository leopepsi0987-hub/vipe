import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us, including your name, email address, and 
              payment information when you create an account or subscribe to our services. We also collect 
              usage data, including the projects you create, features you use, and how you interact with 
              our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to provide, maintain, and improve our Service, process 
              transactions, send you technical notices and support messages, respond to your comments and 
              questions, and communicate with you about products, services, and events.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. We may share your 
              information with service providers who assist us in operating our Service, such as payment 
              processors and hosting providers. We may also disclose information if required by law or to 
              protect our rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal 
              information against unauthorized access, alteration, disclosure, or destruction. However, 
              no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute 
              security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights (GDPR)</h2>
            <p className="text-muted-foreground leading-relaxed">
              Under the General Data Protection Regulation (GDPR), you have the following rights:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-2">
              <li><strong>Right to Access:</strong> You can request a copy of your personal data.</li>
              <li><strong>Right to Rectification:</strong> You can request correction of inaccurate data.</li>
              <li><strong>Right to Erasure:</strong> You can request deletion of your personal data.</li>
              <li><strong>Right to Portability:</strong> You can request your data in a portable format.</li>
              <li><strong>Right to Object:</strong> You can object to processing of your personal data.</li>
              <li><strong>Right to Restrict Processing:</strong> You can request limited processing of your data.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, please contact us at{" "}
              <a href="mailto:vipedz@hotmail.com" className="text-primary hover:underline">
                vipedz@hotmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to collect usage data and improve our Service. 
              Types of cookies we use include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for basic site functionality.</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how you use our Service.</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You can control cookies through your browser settings or our cookie consent banner.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data only for as long as necessary to fulfill the purposes for which 
              it was collected, including to satisfy legal, accounting, or reporting requirements. When 
              your data is no longer required, we will securely delete or anonymize it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place to protect your data in accordance with 
              applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not directed to children under 16 years of age. We do not knowingly collect 
              personal information from children under 16. If we learn that we have collected personal 
              information from a child under 16, we will delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage 
              you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or wish to exercise your rights, please 
              contact our Data Protection Officer at{" "}
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
              <button onClick={() => navigate("/terms")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
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
