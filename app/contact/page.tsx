import Link from 'next/link';

export default function ContactPage() {
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
          <h1 className="text-3xl font-bold mb-8">Contact Us</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Get in Touch</h2>
              <p>
                We value your feedback and are here to help. If you have questions, suggestions, or need support with the Islamic Knowledge Assistant, please don't hesitate to reach out to us.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Support</h2>
              <p>
                For technical support, questions about using the service, or reporting issues, please contact our support team. We strive to respond to all inquiries within 24-48 hours.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Feedback & Suggestions</h2>
              <p>
                Your feedback helps us improve the Islamic Knowledge Assistant. Whether you have suggestions for new features, improvements to existing functionality, or ideas for better serving the Muslim community, we'd love to hear from you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Content Concerns</h2>
              <p>
                If you notice any content that seems inaccurate or inappropriate, please let us know immediately. We take the accuracy and appropriateness of Islamic content very seriously and will investigate all reports promptly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Partnership & Collaboration</h2>
              <p>
                We welcome partnerships with Islamic organizations, scholars, and educational institutions. If you're interested in collaborating to improve Islamic education and outreach, please reach out to discuss opportunities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Response Time</h2>
              <p>
                We aim to respond to all inquiries within 24-48 hours during business days. For urgent matters, please indicate the urgency in your message subject line.
              </p>
            </section>

            <div className="mt-8 p-6 bg-muted/50 rounded-lg">
              <p className="text-sm text-center">
                <strong>Note:</strong> For immediate religious guidance or urgent spiritual matters, please contact your local mosque, Islamic center, or qualified religious scholar in your community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 