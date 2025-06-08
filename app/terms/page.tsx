import Link from 'next/link';

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using this Islamic Knowledge Assistant service, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Use License</h2>
              <p>
                Permission is granted to temporarily use this service for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. Disclaimer</h2>
              <p>
                The information provided by this AI assistant is for educational purposes only. For religious guidance and rulings, please consult with qualified Islamic scholars and local religious authorities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Limitations</h2>
              <p>
                In no event shall the Islamic Knowledge Assistant or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Accuracy of Materials</h2>
              <p>
                The materials appearing on this service could include technical, typographical, or photographic errors. We do not warrant that any of the materials on its service are accurate, complete, or current.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Modifications</h2>
              <p>
                We may revise these terms of service at any time without notice. By using this service, you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 