import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Chat
          </Link>
        </div>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Information We Collect</h2>
              <p>
                We collect information you provide directly to us, such as when you create an account, use our chat service, or contact us for support. This may include your name, email address, and chat conversations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">How We Use Your Information</h2>
              <p>
                We use the information we collect to provide, maintain, and improve our Islamic Knowledge Assistant service, respond to your questions, and communicate with you about our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Information Sharing</h2>
              <p>
                We do not sell, trade, or otherwise transfer your personal information to third parties. Your chat conversations are private and are not shared with others unless you explicitly choose to make them public.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Data Security</h2>
              <p>
                We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Cookies</h2>
              <p>
                We use cookies and similar technologies to enhance your experience, remember your preferences, and analyze how our service is used.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Changes to Privacy Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Contact Us</h2>
              <p>
                If you have any questions about this privacy policy, please contact us through our contact page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 