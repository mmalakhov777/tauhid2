'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { SOURCE_DESCRIPTIONS } from '@/components/source-descriptions';

export default function SourcesPage() {
  const { t } = useTranslations();

  // Classical Islamic Books
  const classicalBooks: Array<{
    title: string;
    image: string;
    description: string;
    author: string;
    category: string;
    link?: string;
  }> = [
    {
      title: 'Fatawa Qazi Khan',
      image: '/images/fatawa-qazi-khan.webp',
      description: SOURCE_DESCRIPTIONS['Fatawa Qazi Khan'],
      author: 'Qazi Khan',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/fatawaqazikhan01/FATAWA-QAZI-KHAN-01/'
    },
    {
      title: 'Rad-ul-Muhtar',
      image: '/images/raddul-muhtaar.webp',
      description: SOURCE_DESCRIPTIONS['Rad-ul-Muhtar'],
      author: 'Ibn Abidin',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/raddulmukhtar'
    },
    {
      title: 'Al-Hidaya',
      image: '/images/Al-Hidaya.webp',
      description: SOURCE_DESCRIPTIONS['Al-Hidaya'],
      author: 'Burhan al-Din al-Marghinani',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/al-hidaya-in-english/mode/2up'
    },

    {
      title: 'Badai-al-Sanai',
      image: '/images/badai-as-sanai-urdu.webp',
      description: SOURCE_DESCRIPTIONS['Badai-al-Sanai'],
      author: 'Al-Kasani',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/BadaeUlSanaiUrdu/Badai-al-Sanai-Urdu-Vol-01/'
    },
    {
      title: 'Sharh al-Wiqayah',
      image: '/images/sharh-al-wiqayah.webp',
      description: SOURCE_DESCRIPTIONS['Sharh al-Wiqayah'],
      author: 'Ubaydullah ibn Masud',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/SharhWiqayah'
    },
    {
      title: 'Al-Mabsut Sarakhsi',
      image: '/images/Al-Mabsut_Sarakhsi_HanafiFiqh.webp',
      description: SOURCE_DESCRIPTIONS['Al-Mabsut Sarakhsi'],
      author: 'Imam al-Sarakhsi',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/almabbsoott/Al-Mabbsoott/'
    },
    {
      title: 'Al-Mabsut Sarakhsi (Index)',
      image: '/images/Al-Mabsut_Sarakhsi_Index.webp',
      description: SOURCE_DESCRIPTIONS['Al-Mabsut Sarakhsi'],
      author: 'Imam al-Sarakhsi',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/almabbsoott/Indices/'
    },
    {
      title: 'Usul al-Fiqh Sarakhsi',
      image: '/images/UsulAlFiqh_Sarakhsi_IslamicLawPrinciples.webp',
      description: SOURCE_DESCRIPTIONS['Usul al-Fiqh Sarakhsi'],
      author: 'Imam al-Sarakhsi',
      category: 'Islamic Legal Methodology',
      link: 'https://archive.org/details/almabbsoott/Uswooli-l-Fiqqh/'
    },
    {
      title: 'Nukat Ziyadat al-Ziyadat',
      image: '/images/Nukat_ZiyadatAlZiyadat_HanafiNotes.webp',
      description: SOURCE_DESCRIPTIONS['Nukat Ziyadat al-Ziyadat'],
      author: 'Various Hanafi Scholars',
      category: 'Hanafi Jurisprudence',
      link: 'https://archive.org/details/almabbsoott/Ann-Nukat/'
    },
    {
      title: 'Sharh Siyar al-Kabir Sarakhsi',
      image: '/images/SharhSiyarAlKabir_Sarakhsi_InternationalLaw.webp',
      description: SOURCE_DESCRIPTIONS['Sharh Siyar al-Kabir Sarakhsi'],
      author: 'Imam al-Sarakhsi',
      category: 'Islamic International Law',
      link: 'https://archive.org/details/almabbsoott/Sharhu-s-Siyaru-l-Kabeer/'
    }
  ];

  // Risale-i Nur Collection
  const risaleBooks: Array<{
    title: string;
    image: string;
    description: string;
    author: string;
    category: string;
    link?: string;
  }> = [
    {
      title: 'Sözler (The Words)',
      image: '/images/risaleinur/Sozler-Bediuzzaman_Said_Nursi.webp',
      description: 'A profound collection of spiritual discourses addressing fundamental questions of faith, existence, and the divine wisdom underlying creation.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Spirituality',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Mektubat (The Letters)',
      image: '/images/risaleinur/Mektubat-Bediuzzaman_Said_Nursi.webp',
      description: 'A collection of letters offering spiritual guidance and addressing contemporary challenges facing Muslims in the modern world.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Spirituality',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Lemalar (The Flashes)',
      image: '/images/risaleinur/lemalar-bediuzzaman_said_nursi.webp',
      description: 'Illuminating treatises that provide spiritual insights and address various aspects of Islamic belief and practice.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Spirituality',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Hasır Risalesi (Treatise on Resurrection)',
      image: '/images/risaleinur/Hasir_Risalesi-Bediuzzaman_Said_Nursi.webp',
      description: 'A comprehensive treatise examining the concept of resurrection and afterlife from both rational and scriptural perspectives.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Theology',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Hastalar Risalesi (Treatise for the Sick)',
      image: '/images/risaleinur/Hastalar_Risalesi-Bediuzzaman_Said_Nursi.webp',
      description: 'A compassionate guide offering spiritual comfort and wisdom for those facing illness and physical challenges.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Spirituality',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'İhlas Risaleleri (Treatises on Sincerity)',
      image: '/images/risaleinur/ihlas_risaleleri-bediuzzaman_said_nursi.webp',
      description: 'Deep reflections on sincerity in worship and the purification of the soul in the path toward divine proximity.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Spirituality',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Otuz Üç Pencere (Thirty-Three Windows)',
      image: '/images/risaleinur/Otuz_Uc_Pencere-Bediuzzaman_Said_Nursi.webp',
      description: 'Thirty-three contemplative windows offering glimpses into the divine names and attributes through natural phenomena.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Theology',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Enne ve Zerre Risalesi (Treatise on the Self and Particle)',
      image: '/images/risaleinur/enne_ve_zerre_risalesi-bediuzzaman_said_nursi.webp',
      description: 'A philosophical treatise exploring the relationship between the individual self and the cosmic order in divine creation.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Philosophy',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Tabiat Risalesi (Treatise on Nature)',
      image: '/images/risaleinur/tabiat_risalesi-bediuzzaman_said_nursi.webp',
      description: 'An examination of nature as a book of divine signs, refuting materialistic interpretations of natural phenomena.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Philosophy',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    },
    {
      title: 'Kader Risalesi (Treatise on Divine Decree)',
      image: '/images/risaleinur/kader_risalesi-bediuzzaman_said_nursi.webp',
      description: 'A comprehensive exploration of divine decree and human free will, addressing one of the most complex theological questions.',
      author: 'Bediuzzaman Said Nursi',
      category: 'Islamic Theology',
      link: 'https://archive.org/details/risaleinur-bediuzzaman-said-nursi-sadelestirilmis/'
    }
  ];

  // Tafsir Collection
  const tafsirBooks: Array<{
    title: string;
    image: string;
    description: string;
    author: string;
    category: string;
    link?: string;
  }> = [
    {
      title: 'Maarif-ul-Quran',
      image: '/images/Maarif-ul-Quran.webp',
      description: 'A comprehensive Urdu commentary on the Quran by Mufti Muhammad Shafi, providing detailed explanations of Quranic verses with jurisprudential insights and practical applications for contemporary Muslims.',
      author: 'Mufti Muhammad Shafi',
      category: 'Quranic Commentary',
      link: 'https://archive.org/details/maarifulquran-english'
    },
    {
      title: 'Tafsir Bayan ul Quran',
      image: '/images/Bayan-ul-Quran.webp',
      description: 'An eloquent Urdu commentary on the Quran by Dr. Israr Ahmed, known for its clear explanations and emphasis on the Quran\'s guidance for individual and collective reformation.',
      author: 'Dr. Israr Ahmed',
      category: 'Quranic Commentary',
      link: 'https://archive.org/details/BayanUlQuranDrIsrarAhmad'
    },
    {
      title: 'Kashf Al-Asrar Tafsir',
      image: '/images/Kashf-Al-Asrar.webp',
      description: 'A classical Persian commentary on the Quran by Rashid al-Din Maybudi, combining literal interpretation with mystical insights and spiritual reflections on the divine text.',
      author: 'Rashid al-Din Maybudi',
      category: 'Classical Tafsir',
      link: 'https://archive.org/details/kashf-al-asrar'
    },
    {
      title: 'Tazkirul Quran',
      image: '/images/Tazkirul-Quran.webp',
      description: 'A modern Urdu commentary focusing on the Quran\'s moral and spiritual teachings, emphasizing practical guidance for contemporary Muslim life and character development.',
      author: 'Various Contemporary Scholars',
      category: 'Contemporary Tafsir',
      link: 'https://archive.org/details/tazkirul-quran'
    },
    {
      title: 'Tafseer Tanwir al-Miqbas',
      image: '/images/Tanweer-Tafsir.webp',
      description: 'An early classical commentary attributed to Ibn Abbas, providing foundational interpretations of Quranic verses that have influenced Islamic scholarship for centuries.',
      author: 'Attributed to Ibn Abbas',
      category: 'Classical Tafsir',
      link: 'https://archive.org/details/tanwir-al-miqbas'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Chat
          </Link>
        </div>
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Our Sources</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Our AI draws knowledge from a carefully curated collection of authentic Islamic sources, 
            including classical jurisprudential texts, spiritual works, and contemporary scholarly materials. 
            These sources represent centuries of Islamic scholarship and provide the foundation for reliable, 
            well-informed responses to your questions.
          </p>
        </div>

        {/* Tafsir Collection */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Quranic Commentaries (Tafsir)</h2>
          <p className="text-muted-foreground mb-8 max-w-4xl">
            These authoritative commentaries on the Quran provide deep insights into the meaning and interpretation 
            of the divine text. They combine classical scholarship with contemporary understanding, offering 
            comprehensive explanations of Quranic verses and their practical applications.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tafsirBooks.map((book, index) => (
              <div key={index} className="bg-card rounded-lg border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-[3/4] relative bg-muted">
                  <img 
                    src={book.image} 
                    alt={`${book.title} cover`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{book.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{book.author}</p>
                  <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs rounded-full mb-3">
                    {book.category}
                  </span>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{book.description}</p>
                  {book.link && (
                    <a 
                      href={book.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      View on Archive.org →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Classical Islamic Texts */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Classical Islamic Texts</h2>
          <p className="text-muted-foreground mb-8 max-w-4xl">
            These foundational works of Islamic jurisprudence and scholarship have guided Muslim communities 
            for centuries. They represent the pinnacle of Islamic legal thought and provide authoritative 
            guidance on matters of faith and practice.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {classicalBooks.map((book, index) => (
              <div key={index} className="bg-card rounded-lg border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-[3/4] relative bg-muted">
                  <img 
                    src={book.image} 
                    alt={`${book.title} cover`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{book.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{book.author}</p>
                  <span className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs rounded-full mb-3">
                    {book.category}
                  </span>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{book.description}</p>
                  {book.link && (
                    <a 
                      href={book.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      View on Archive.org →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Risale-i Nur Collection */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Risale-i Nur Collection</h2>
          <p className="text-muted-foreground mb-8 max-w-4xl">
            The Risale-i Nur (Epistles of Light) is a contemporary masterwork of Islamic spirituality and theology 
            by Bediuzzaman Said Nursi. These works address the challenges of modern life while providing profound 
            insights into Islamic faith, practice, and the harmony between science and religion.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {risaleBooks.map((book, index) => (
              <div key={index} className="bg-card rounded-lg border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-[3/4] relative bg-muted">
                  <img 
                    src={book.image} 
                    alt={`${book.title} cover`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{book.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{book.author}</p>
                  <span className="inline-block px-2 py-1 bg-secondary/50 text-secondary-foreground text-xs rounded-full mb-3">
                    {book.category}
                  </span>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{book.description}</p>
                  {book.link && (
                    <a 
                      href={book.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      View on Archive.org →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Additional Sources */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-foreground">Online Islamic Resources</h2>
          <p className="text-muted-foreground mb-8 max-w-4xl">
            In addition to classical texts, our AI also references contemporary Islamic Q&A platforms 
            and scholarly websites that provide authentic Islamic guidance for modern questions and situations.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'IslamQA.org', description: SOURCE_DESCRIPTIONS['islamqa.org'], url: 'https://islamqa.org' },
              { name: 'Muftionline.co.za', description: SOURCE_DESCRIPTIONS['muftionline.co.za'], url: 'https://muftionline.co.za' },
              { name: 'Daruliftaa.us', description: SOURCE_DESCRIPTIONS['daruliftaa.us'], url: 'https://daruliftaa.us' },
              { name: 'Askimam.org', description: SOURCE_DESCRIPTIONS['askimam.org'], url: 'https://askimam.org' },
              { name: 'Seekersguidance.org', description: SOURCE_DESCRIPTIONS['seekersguidance.org'], url: 'https://seekersguidance.org' },
              { name: 'Darulifta Deoband', description: SOURCE_DESCRIPTIONS['darulifta-deoband.com'], url: 'https://darulifta-deoband.com' }
            ].map((source, index) => (
              <div key={index} className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-foreground mb-3">{source.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{source.description}</p>
                <a 
                  href={source.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Visit Website →
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section className="bg-muted/30 rounded-lg p-8 border border-border">
          <h2 className="text-2xl font-semibold mb-4 text-foreground">Our Methodology</h2>
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-muted-foreground mb-4">
              Our AI system carefully analyzes these authentic Islamic sources to provide well-informed responses. 
              Each answer is grounded in traditional Islamic scholarship while being accessible to contemporary readers.
            </p>
            <ul className="text-muted-foreground space-y-2">
              <li>• <strong>Authenticity:</strong> All sources are verified Islamic texts and reputable scholarly platforms</li>
              <li>• <strong>Diversity:</strong> We include both classical jurisprudential works and modern interpretations</li>
              <li>• <strong>Accuracy:</strong> Citations are provided so you can verify information directly from the source</li>
              <li>• <strong>Context:</strong> Responses consider both traditional teachings and contemporary applications</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              <strong>Important Note:</strong> While our AI provides well-researched Islamic guidance, 
              for complex personal matters or formal religious rulings, we recommend consulting with qualified Islamic scholars.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
} 