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
              <h2 className="text-xl font-semibold text-foreground mb-3">Precise Grounding on Trustworthy Sources</h2>
              <p>
                Our AI assistant is built upon a comprehensive foundation of authentic Islamic sources, ensuring accuracy and reliability in every response. We draw from:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The complete <strong>Risale-i Nur Collection</strong> by Bediuzzaman Said Nursi, including Sözler, Mektubat, Lemalar, and specialized treatises like Kader Risalesi, İhlas Risaleleri, and Tabiat Risalesi</li>
                <li>Classical Hanafi jurisprudence texts such as <strong>Raddul-Muhtaar</strong>, <strong>Fatawa Qazi Khan</strong>, <strong>Fatuhat-i Alamgiri</strong>, and <strong>Sharh al-Wiqayah</strong></li>
                <li>Works by <strong>Sadr al-Shari'ah</strong> and other renowned classical scholars</li>
                <li>Authentic Hadith collections (Sahih Bukhari, Sahih Muslim, and other reliable compilations)</li>
                <li>Classical Tafsir works and contemporary scholarly interpretations</li>
                <li>Urdu classical texts like <strong>Badai as-Sanai</strong> and other trusted sources</li>
                <li>Content from verified YouTube channels of reputable Islamic scholars and educators</li>
                <li>Peer-reviewed Islamic academic publications</li>
              </ul>
              <p className="mt-2">
                Every answer is grounded in these verified sources, providing you with knowledge that is both authentic and traceable to its original Islamic foundations. Our collection spans from classical 13th-century texts to modern scholarly works, ensuring comprehensive coverage of Islamic knowledge.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Multilingual Support</h2>
              <p>
                Our AI breaks down language barriers to make Islamic knowledge accessible to Muslims worldwide. Key features include:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Ask questions in any language - English, Arabic, Urdu, Turkish, Indonesian, French, Russian, and many more</li>
                <li>Receive answers in your preferred language, regardless of the source language</li>
                <li>Access to sources in Arabic and Urdu with seamless translation to English, Russian, or your chosen language</li>
                <li>Preserve the authenticity of original texts while providing clear translations</li>
                <li>Cultural context adaptation to help you understand concepts in your local context</li>
              </ul>
              <p className="mt-2">
                Whether the original source is a classical Arabic text or a modern Urdu lecture, you can easily read and understand it in English, Russian, or any other supported language, making authentic Islamic knowledge truly global and accessible.
              </p>
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