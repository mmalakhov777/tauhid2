import Link from 'next/link';

export default function AboutPage() {
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
          <h1 className="text-3xl font-bold mb-8">About Islamic Knowledge Assistant</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Our Mission</h2>
              <p>
                The Islamic Knowledge Assistant is designed to provide accessible Islamic education and guidance to Muslims around the world. Our goal is to make authentic Islamic knowledge available to everyone, regardless of their location or background.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">What We Offer</h2>
              <p>
                Our AI-powered assistant can help you with various aspects of Islamic knowledge, including:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Quranic verses and their interpretations</li>
                <li>Hadith and Sunnah guidance</li>
                <li>Islamic jurisprudence (Fiqh)</li>
                <li>Prayer times and rituals</li>
                <li>Islamic history and culture</li>
                <li>Daily Islamic practices</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Important Disclaimer</h2>
              <p>
                While we strive to provide accurate and helpful information, this service is for educational purposes only. For important religious decisions, rulings, or guidance, we strongly recommend consulting with qualified Islamic scholars, local Imams, or religious authorities in your community.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Our Commitment</h2>
              <p>
                We are committed to providing respectful, accurate, and beneficial Islamic knowledge while maintaining the highest standards of Islamic ethics and values. We continuously work to improve our service and ensure it serves the Muslim community effectively.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Community</h2>
              <p>
                This service is built for the global Muslim community. We welcome feedback and suggestions to help us better serve your needs and improve the quality of Islamic education we provide.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 