export interface TelegramTranslations {
  welcome: {
    greeting: string;
    description: string;
    howToAsk: string;
    textMessages: string;
    voiceMessages: string;
    forwardMessages: string;
    whatICanHelp: string;
    quranicVerses: string;
    islamicTeachings: string;
    hadithScholarly: string;
    prayerWorship: string;
    risaleNur: string;
    howItWorks: string;
    step1: string;
    step2: string;
    step3: string;
    completeResponse: string;
    dedicatedUI: string;
    enhancedSearch: string;
    chatHistory: string;
    accessFullService: string;
    menuButton: string;
    exampleQuestions: string;
    prayerExample: string;
    tawhidExample: string;
    pillarsExample: string;
    feelFree: string;
  };
  help: {
    title: string;
    description: string;
    sources: string;
    quranHadith: string;
    classicalScholarship: string;
    modernTeachings: string;
    risaleNurCollection: string;
    educationalContent: string;
    tipsTitle: string;
    beSpecific: string;
    oneQuestion: string;
    clearLanguage: string;
    commands: string;
    startCommand: string;
    helpCommand: string;
    blessing: string;
  };
  processing: {
    transcribing: string;
    convertingSpeech: string;
    audioTranscribed: string;
    preparingSearch: string;
    initializingSearch: string;
    searchingSources: string;
  };
  errors: {
    audioProcessError: string;
    transcriptionFailed: string;
    technicalIssue: string;
    authenticationFailed: string;
  };
  buttons: {
    fullResponse: string;
  };
}

const translations: Record<string, TelegramTranslations> = {
  // English (default)
  en: {
    welcome: {
      greeting: "🕌 *Assalamu Alaikum, {userName}!*",
      description: "Welcome to the Islamic Q&A Bot! I can answer your Islamic questions directly here in Telegram using authentic sources.",
      howToAsk: "*How to ask questions:*",
      textMessages: "📝 *Text messages* - Type your question directly",
      voiceMessages: "🎤 *Voice messages* - Record your question and I'll transcribe it",
      forwardMessages: "📤 *Forward messages* - Forward questions from other chats (including voice messages)",
      whatICanHelp: "*What I can help with:*",
      quranicVerses: "📚 Quranic verses and interpretations",
      islamicTeachings: "🕌 Islamic teachings and practices",
      hadithScholarly: "📖 Hadith and scholarly opinions",
      prayerWorship: "🤲 Prayer, worship, and daily Islamic life",
      risaleNur: "📜 Risale-i Nur teachings",
      howItWorks: "*How it works:*",
      step1: "1. Ask your question (text or voice)",
      step2: "2. I'll provide a comprehensive answer here",
      step3: "3. Get a button to access the *full mini-app* with:",
      completeResponse: "• Complete response with citations",
      dedicatedUI: "• Dedicated UI with more features",
      enhancedSearch: "• Enhanced search capabilities",
      chatHistory: "• Chat history and more",
      accessFullService: "*Access the full service:*",
      menuButton: "Use the menu button or the link in my responses to access the complete TauhidAI experience!",
      exampleQuestions: "*Example questions:*",
      prayerExample: "• \"What does Islam say about prayer?\"",
      tawhidExample: "• \"Can you explain the concept of Tawhid?\"",
      pillarsExample: "• \"What are the pillars of Islam?\"",
      feelFree: "Feel free to ask me anything! 🤲"
    },
    help: {
      title: "🤖 *How to use this bot:*",
      description: "*Ask any Islamic question* and I'll provide answers based on:",
      sources: "",
      quranHadith: "📖 Quran and authentic Hadith",
      classicalScholarship: "🕌 Classical Islamic scholarship",
      modernTeachings: "📚 Modern Islamic teachings",
      risaleNurCollection: "📜 Risale-i Nur collection",
      educationalContent: "🎥 Educational Islamic content",
      tipsTitle: "*Tips for better answers:*",
      beSpecific: "• Be specific in your questions",
      oneQuestion: "• Ask one question at a time",
      clearLanguage: "• Use clear, simple language",
      commands: "*Commands:*",
      startCommand: "/start - Welcome message",
      helpCommand: "/help - This help message",
      blessing: "May Allah guide us all! 🤲"
    },
    processing: {
      transcribing: "🎤 *Transcribing your audio message...*",
      convertingSpeech: "⏳ Converting speech to text...",
      audioTranscribed: "🎤 *Audio transcribed:*",
      preparingSearch: "🔍 *Preparing to search Islamic sources...*",
      initializingSearch: "⏳ Initializing search... (~{time} sec)",
      searchingSources: "🔍 *Searching Islamic sources...*"
    },
    errors: {
      audioProcessError: "❌ Sorry, I could not process the audio file. Please try again.",
      transcriptionFailed: "❌ Sorry, I could not transcribe the audio. Please try sending a clearer audio message.",
      technicalIssue: "❌ I apologize, but I encountered a technical issue while processing your question. Please try again in a moment.",
      authenticationFailed: "❌ Sorry, I encountered an issue with user authentication. Please try again later."
    },
    buttons: {
      fullResponse: "📚 Full Response & Citations"
    }
  },

  // Russian
  ru: {
    welcome: {
      greeting: "🕌 *Ассаляму алейкум, {userName}!*",
      description: "Добро пожаловать в исламский бот вопросов и ответов! Я могу отвечать на ваши исламские вопросы прямо здесь в Telegram, используя достоверные источники.",
      howToAsk: "*Как задавать вопросы:*",
      textMessages: "📝 *Текстовые сообщения* - Напишите свой вопрос напрямую",
      voiceMessages: "🎤 *Голосовые сообщения* - Запишите свой вопрос, и я его расшифрую",
      forwardMessages: "📤 *Пересылка сообщений* - Пересылайте вопросы из других чатов (включая голосовые)",
      whatICanHelp: "*С чем я могу помочь:*",
      quranicVerses: "📚 Коранические аяты и толкования",
      islamicTeachings: "🕌 Исламские учения и практики",
      hadithScholarly: "📖 Хадисы и мнения ученых",
      prayerWorship: "🤲 Молитва, поклонение и повседневная исламская жизнь",
      risaleNur: "📜 Учения Рисале-и Нур",
      howItWorks: "*Как это работает:*",
      step1: "1. Задайте свой вопрос (текстом или голосом)",
      step2: "2. Я дам исчерпывающий ответ здесь",
      step3: "3. Получите кнопку для доступа к *полному мини-приложению* с:",
      completeResponse: "• Полный ответ с цитатами",
      dedicatedUI: "• Специальный интерфейс с дополнительными функциями",
      enhancedSearch: "• Расширенные возможности поиска",
      chatHistory: "• История чатов и многое другое",
      accessFullService: "*Доступ к полному сервису:*",
      menuButton: "Используйте кнопку меню или ссылку в моих ответах для доступа к полному опыту TauhidAI!",
      exampleQuestions: "*Примеры вопросов:*",
      prayerExample: "• \"Что говорит Ислам о молитве?\"",
      tawhidExample: "• \"Можете ли вы объяснить концепцию Таухида?\"",
      pillarsExample: "• \"Каковы столпы Ислама?\"",
      feelFree: "Не стесняйтесь спрашивать меня о чем угодно! 🤲"
    },
    help: {
      title: "🤖 *Как использовать этого бота:*",
      description: "*Задайте любой исламский вопрос*, и я дам ответы на основе:",
      sources: "",
      quranHadith: "📖 Коран и достоверные хадисы",
      classicalScholarship: "🕌 Классическая исламская наука",
      modernTeachings: "📚 Современные исламские учения",
      risaleNurCollection: "📜 Коллекция Рисале-и Нур",
      educationalContent: "🎥 Образовательный исламский контент",
      tipsTitle: "*Советы для лучших ответов:*",
      beSpecific: "• Будьте конкретны в своих вопросах",
      oneQuestion: "• Задавайте по одному вопросу за раз",
      clearLanguage: "• Используйте ясный, простой язык",
      commands: "*Команды:*",
      startCommand: "/start - Приветственное сообщение",
      helpCommand: "/help - Это справочное сообщение",
      blessing: "Да направит нас всех Аллах! 🤲"
    },
    processing: {
      transcribing: "🎤 *Расшифровка вашего голосового сообщения...*",
      convertingSpeech: "⏳ Преобразование речи в текст...",
      audioTranscribed: "🎤 *Аудио расшифровано:*",
      preparingSearch: "🔍 *Подготовка к поиску в исламских источниках...*",
      initializingSearch: "⏳ Инициализация поиска... (~{time} сек)",
      searchingSources: "🔍 *Поиск в исламских источниках...*"
    },
    errors: {
      audioProcessError: "❌ Извините, не удалось обработать аудиофайл. Пожалуйста, попробуйте еще раз.",
      transcriptionFailed: "❌ Извините, не удалось расшифровать аудио. Пожалуйста, отправьте более четкое голосовое сообщение.",
      technicalIssue: "❌ Извините, но я столкнулся с технической проблемой при обработке вашего вопроса. Пожалуйста, попробуйте еще раз через минуту.",
      authenticationFailed: "❌ Извините, возникла проблема с аутентификацией пользователя. Пожалуйста, попробуйте позже."
    },
    buttons: {
      fullResponse: "📚 Полный ответ и цитаты"
    }
  },

  // Spanish
  es: {
    welcome: {
      greeting: "🕌 *¡Assalamu Alaikum, {userName}!*",
      description: "¡Bienvenido al Bot de Preguntas y Respuestas Islámicas! Puedo responder tus preguntas islámicas directamente aquí en Telegram usando fuentes auténticas.",
      howToAsk: "*Cómo hacer preguntas:*",
      textMessages: "📝 *Mensajes de texto* - Escribe tu pregunta directamente",
      voiceMessages: "🎤 *Mensajes de voz* - Graba tu pregunta y la transcribiré",
      forwardMessages: "📤 *Reenviar mensajes* - Reenvía preguntas de otros chats (incluyendo mensajes de voz)",
      whatICanHelp: "*En qué puedo ayudar:*",
      quranicVerses: "📚 Versículos coránicos e interpretaciones",
      islamicTeachings: "🕌 Enseñanzas y prácticas islámicas",
      hadithScholarly: "📖 Hadices y opiniones académicas",
      prayerWorship: "🤲 Oración, adoración y vida islámica diaria",
      risaleNur: "📜 Enseñanzas de Risale-i Nur",
      howItWorks: "*Cómo funciona:*",
      step1: "1. Haz tu pregunta (texto o voz)",
      step2: "2. Te daré una respuesta completa aquí",
      step3: "3. Obtén un botón para acceder a la *mini-app completa* con:",
      completeResponse: "• Respuesta completa con citas",
      dedicatedUI: "• Interfaz dedicada con más funciones",
      enhancedSearch: "• Capacidades de búsqueda mejoradas",
      chatHistory: "• Historial de chat y más",
      accessFullService: "*Accede al servicio completo:*",
      menuButton: "¡Usa el botón del menú o el enlace en mis respuestas para acceder a la experiencia completa de TauhidAI!",
      exampleQuestions: "*Preguntas de ejemplo:*",
      prayerExample: "• \"¿Qué dice el Islam sobre la oración?\"",
      tawhidExample: "• \"¿Puedes explicar el concepto de Tawhid?\"",
      pillarsExample: "• \"¿Cuáles son los pilares del Islam?\"",
      feelFree: "¡No dudes en preguntarme cualquier cosa! 🤲"
    },
    help: {
      title: "🤖 *Cómo usar este bot:*",
      description: "*Haz cualquier pregunta islámica* y te daré respuestas basadas en:",
      sources: "",
      quranHadith: "📖 Corán y Hadices auténticos",
      classicalScholarship: "🕌 Erudición islámica clásica",
      modernTeachings: "📚 Enseñanzas islámicas modernas",
      risaleNurCollection: "📜 Colección Risale-i Nur",
      educationalContent: "🎥 Contenido educativo islámico",
      tipsTitle: "*Consejos para mejores respuestas:*",
      beSpecific: "• Sé específico en tus preguntas",
      oneQuestion: "• Haz una pregunta a la vez",
      clearLanguage: "• Usa un lenguaje claro y simple",
      commands: "*Comandos:*",
      startCommand: "/start - Mensaje de bienvenida",
      helpCommand: "/help - Este mensaje de ayuda",
      blessing: "¡Que Alá nos guíe a todos! 🤲"
    },
    processing: {
      transcribing: "🎤 *Transcribiendo tu mensaje de audio...*",
      convertingSpeech: "⏳ Convirtiendo voz a texto...",
      audioTranscribed: "🎤 *Audio transcrito:*",
      preparingSearch: "🔍 *Preparando búsqueda en fuentes islámicas...*",
      initializingSearch: "⏳ Inicializando búsqueda... (~{time} seg)",
      searchingSources: "🔍 *Buscando en fuentes islámicas...*"
    },
    errors: {
      audioProcessError: "❌ Lo siento, no pude procesar el archivo de audio. Por favor, inténtalo de nuevo.",
      transcriptionFailed: "❌ Lo siento, no pude transcribir el audio. Por favor, envía un mensaje de voz más claro.",
      technicalIssue: "❌ Me disculpo, pero encontré un problema técnico al procesar tu pregunta. Por favor, inténtalo de nuevo en un momento.",
      authenticationFailed: "❌ Lo siento, encontré un problema con la autenticación del usuario. Por favor, inténtalo más tarde."
    },
    buttons: {
      fullResponse: "📚 Respuesta Completa y Citas"
    }
  },

  // French
  fr: {
    welcome: {
      greeting: "🕌 *Assalamu Alaikum, {userName} !*",
      description: "Bienvenue dans le Bot de Questions-Réponses Islamiques ! Je peux répondre à vos questions islamiques directement ici sur Telegram en utilisant des sources authentiques.",
      howToAsk: "*Comment poser des questions :*",
      textMessages: "📝 *Messages texte* - Tapez votre question directement",
      voiceMessages: "🎤 *Messages vocaux* - Enregistrez votre question et je la transcrirai",
      forwardMessages: "📤 *Transférer des messages* - Transférez des questions d'autres chats (y compris les messages vocaux)",
      whatICanHelp: "*Ce avec quoi je peux aider :*",
      quranicVerses: "📚 Versets coraniques et interprétations",
      islamicTeachings: "🕌 Enseignements et pratiques islamiques",
      hadithScholarly: "📖 Hadiths et opinions savantes",
      prayerWorship: "🤲 Prière, adoration et vie islamique quotidienne",
      risaleNur: "📜 Enseignements de Risale-i Nur",
      howItWorks: "*Comment ça marche :*",
      step1: "1. Posez votre question (texte ou voix)",
      step2: "2. Je fournirai une réponse complète ici",
      step3: "3. Obtenez un bouton pour accéder à la *mini-app complète* avec :",
      completeResponse: "• Réponse complète avec citations",
      dedicatedUI: "• Interface dédiée avec plus de fonctionnalités",
      enhancedSearch: "• Capacités de recherche améliorées",
      chatHistory: "• Historique des chats et plus",
      accessFullService: "*Accédez au service complet :*",
      menuButton: "Utilisez le bouton de menu ou le lien dans mes réponses pour accéder à l'expérience complète TauhidAI !",
      exampleQuestions: "*Exemples de questions :*",
      prayerExample: "• \"Que dit l'Islam sur la prière ?\"",
      tawhidExample: "• \"Pouvez-vous expliquer le concept de Tawhid ?\"",
      pillarsExample: "• \"Quels sont les piliers de l'Islam ?\"",
      feelFree: "N'hésitez pas à me demander quoi que ce soit ! 🤲"
    },
    help: {
      title: "🤖 *Comment utiliser ce bot :*",
      description: "*Posez n'importe quelle question islamique* et je fournirai des réponses basées sur :",
      sources: "",
      quranHadith: "📖 Coran et Hadiths authentiques",
      classicalScholarship: "🕌 Érudition islamique classique",
      modernTeachings: "📚 Enseignements islamiques modernes",
      risaleNurCollection: "📜 Collection Risale-i Nur",
      educationalContent: "🎥 Contenu éducatif islamique",
      tipsTitle: "*Conseils pour de meilleures réponses :*",
      beSpecific: "• Soyez spécifique dans vos questions",
      oneQuestion: "• Posez une question à la fois",
      clearLanguage: "• Utilisez un langage clair et simple",
      commands: "*Commandes :*",
      startCommand: "/start - Message de bienvenue",
      helpCommand: "/help - Ce message d'aide",
      blessing: "Qu'Allah nous guide tous ! 🤲"
    },
    processing: {
      transcribing: "🎤 *Transcription de votre message audio...*",
      convertingSpeech: "⏳ Conversion de la parole en texte...",
      audioTranscribed: "🎤 *Audio transcrit :*",
      preparingSearch: "🔍 *Préparation de la recherche dans les sources islamiques...*",
      initializingSearch: "⏳ Initialisation de la recherche... (~{time} sec)",
      searchingSources: "🔍 *Recherche dans les sources islamiques...*"
    },
    errors: {
      audioProcessError: "❌ Désolé, je n'ai pas pu traiter le fichier audio. Veuillez réessayer.",
      transcriptionFailed: "❌ Désolé, je n'ai pas pu transcrire l'audio. Veuillez envoyer un message vocal plus clair.",
      technicalIssue: "❌ Je m'excuse, mais j'ai rencontré un problème technique lors du traitement de votre question. Veuillez réessayer dans un moment.",
      authenticationFailed: "❌ Désolé, j'ai rencontré un problème avec l'authentification de l'utilisateur. Veuillez réessayer plus tard."
    },
    buttons: {
      fullResponse: "📚 Réponse Complète et Citations"
    }
  },

  // Turkish
  tr: {
    welcome: {
      greeting: "🕌 *Esselamü aleyküm, {userName}!*",
      description: "İslami Soru-Cevap Botuna hoş geldiniz! İslami sorularınızı doğrudan burada Telegram'da otantik kaynaklar kullanarak cevaplayabilirim.",
      howToAsk: "*Nasıl soru sorulur:*",
      textMessages: "📝 *Metin mesajları* - Sorunuzu doğrudan yazın",
      voiceMessages: "🎤 *Sesli mesajlar* - Sorunuzu kaydedin, ben çeviririm",
      forwardMessages: "📤 *Mesaj iletme* - Diğer sohbetlerden soruları iletin (sesli mesajlar dahil)",
      whatICanHelp: "*Nelerle yardımcı olabilirim:*",
      quranicVerses: "📚 Kuran ayetleri ve yorumları",
      islamicTeachings: "🕌 İslami öğretiler ve uygulamalar",
      hadithScholarly: "📖 Hadisler ve alim görüşleri",
      prayerWorship: "🤲 Namaz, ibadet ve günlük İslami yaşam",
      risaleNur: "📜 Risale-i Nur öğretileri",
      howItWorks: "*Nasıl çalışır:*",
      step1: "1. Sorunuzu sorun (metin veya ses)",
      step2: "2. Size burada kapsamlı bir cevap vereceğim",
      step3: "3. *Tam mini-uygulamaya* erişim için bir buton alın:",
      completeResponse: "• Alıntılarla tam cevap",
      dedicatedUI: "• Daha fazla özellikli özel arayüz",
      enhancedSearch: "• Gelişmiş arama yetenekleri",
      chatHistory: "• Sohbet geçmişi ve daha fazlası",
      accessFullService: "*Tam hizmete erişim:*",
      menuButton: "Tam TauhidAI deneyimine erişmek için menü butonunu veya cevaplarımdaki bağlantıyı kullanın!",
      exampleQuestions: "*Örnek sorular:*",
      prayerExample: "• \"İslam namaz hakkında ne der?\"",
      tawhidExample: "• \"Tevhid kavramını açıklayabilir misiniz?\"",
      pillarsExample: "• \"İslam'ın şartları nelerdir?\"",
      feelFree: "Bana her şeyi sormaktan çekinmeyin! 🤲"
    },
    help: {
      title: "🤖 *Bu botu nasıl kullanılır:*",
      description: "*Herhangi bir İslami soru sorun* ve şunlara dayalı cevaplar vereceğim:",
      sources: "",
      quranHadith: "📖 Kuran ve sahih hadisler",
      classicalScholarship: "🕌 Klasik İslam ilmi",
      modernTeachings: "📚 Modern İslami öğretiler",
      risaleNurCollection: "📜 Risale-i Nur koleksiyonu",
      educationalContent: "🎥 Eğitici İslami içerik",
      tipsTitle: "*Daha iyi cevaplar için ipuçları:*",
      beSpecific: "• Sorularınızda spesifik olun",
      oneQuestion: "• Bir seferde bir soru sorun",
      clearLanguage: "• Açık, basit dil kullanın",
      commands: "*Komutlar:*",
      startCommand: "/start - Hoş geldin mesajı",
      helpCommand: "/help - Bu yardım mesajı",
      blessing: "Allah hepimizi hidayete erdirsin! 🤲"
    },
    processing: {
      transcribing: "🎤 *Sesli mesajınız çevriliyor...*",
      convertingSpeech: "⏳ Konuşma metne dönüştürülüyor...",
      audioTranscribed: "🎤 *Ses çevrildi:*",
      preparingSearch: "🔍 *İslami kaynaklarda arama hazırlanıyor...*",
      initializingSearch: "⏳ Arama başlatılıyor... (~{time} san)",
      searchingSources: "🔍 *İslami kaynaklarda aranıyor...*"
    },
    errors: {
      audioProcessError: "❌ Üzgünüm, ses dosyasını işleyemedim. Lütfen tekrar deneyin.",
      transcriptionFailed: "❌ Üzgünüm, sesi çeviremedim. Lütfen daha net bir sesli mesaj gönderin.",
      technicalIssue: "❌ Özür dilerim, sorunuzu işlerken teknik bir sorunla karşılaştım. Lütfen bir dakika sonra tekrar deneyin.",
      authenticationFailed: "❌ Üzgünüm, kullanıcı kimlik doğrulamasında bir sorun yaşadım. Lütfen daha sonra tekrar deneyin."
    },
    buttons: {
      fullResponse: "📚 Tam Cevap ve Alıntılar"
    }
  },

  // Arabic
  ar: {
    welcome: {
      greeting: "🕌 *السلام عليكم، {userName}!*",
      description: "مرحباً بك في بوت الأسئلة والأجوبة الإسلامية! يمكنني الإجابة على أسئلتك الإسلامية مباشرة هنا في تيليجرام باستخدام مصادر موثقة.",
      howToAsk: "*كيفية طرح الأسئلة:*",
      textMessages: "📝 *الرسائل النصية* - اكتب سؤالك مباشرة",
      voiceMessages: "🎤 *الرسائل الصوتية* - سجل سؤالك وسأقوم بتحويله إلى نص",
      forwardMessages: "📤 *إعادة توجيه الرسائل* - أعد توجيه الأسئلة من المحادثات الأخرى (بما في ذلك الرسائل الصوتية)",
      whatICanHelp: "*ما يمكنني المساعدة فيه:*",
      quranicVerses: "📚 الآيات القرآنية والتفسيرات",
      islamicTeachings: "🕌 التعاليم والممارسات الإسلامية",
      hadithScholarly: "📖 الأحاديث وآراء العلماء",
      prayerWorship: "🤲 الصلاة والعبادة والحياة الإسلامية اليومية",
      risaleNur: "📜 تعاليم رسائل النور",
      howItWorks: "*كيف يعمل:*",
      step1: "1. اطرح سؤالك (نص أو صوت)",
      step2: "2. سأقدم إجابة شاملة هنا",
      step3: "3. احصل على زر للوصول إلى *التطبيق المصغر الكامل* مع:",
      completeResponse: "• إجابة كاملة مع الاستشهادات",
      dedicatedUI: "• واجهة مخصصة مع المزيد من الميزات",
      enhancedSearch: "• قدرات بحث محسنة",
      chatHistory: "• تاريخ المحادثات والمزيد",
      accessFullService: "*الوصول إلى الخدمة الكاملة:*",
      menuButton: "استخدم زر القائمة أو الرابط في إجاباتي للوصول إلى تجربة TauhidAI الكاملة!",
      exampleQuestions: "*أمثلة على الأسئلة:*",
      prayerExample: "• \"ماذا يقول الإسلام عن الصلاة؟\"",
      tawhidExample: "• \"هل يمكنك شرح مفهوم التوحيد؟\"",
      pillarsExample: "• \"ما هي أركان الإسلام؟\"",
      feelFree: "لا تتردد في سؤالي عن أي شيء! 🤲"
    },
    help: {
      title: "🤖 *كيفية استخدام هذا البوت:*",
      description: "*اطرح أي سؤال إسلامي* وسأقدم إجابات مبنية على:",
      sources: "",
      quranHadith: "📖 القرآن والأحاديث الصحيحة",
      classicalScholarship: "🕌 العلوم الإسلامية الكلاسيكية",
      modernTeachings: "📚 التعاليم الإسلامية الحديثة",
      risaleNurCollection: "📜 مجموعة رسائل النور",
      educationalContent: "🎥 المحتوى التعليمي الإسلامي",
      tipsTitle: "*نصائح للحصول على إجابات أفضل:*",
      beSpecific: "• كن محدداً في أسئلتك",
      oneQuestion: "• اطرح سؤالاً واحداً في كل مرة",
      clearLanguage: "• استخدم لغة واضحة وبسيطة",
      commands: "*الأوامر:*",
      startCommand: "/start - رسالة الترحيب",
      helpCommand: "/help - رسالة المساعدة هذه",
      blessing: "هدانا الله جميعاً! 🤲"
    },
    processing: {
      transcribing: "🎤 *جاري تحويل رسالتك الصوتية...*",
      convertingSpeech: "⏳ تحويل الكلام إلى نص...",
      audioTranscribed: "🎤 *تم تحويل الصوت:*",
      preparingSearch: "🔍 *جاري التحضير للبحث في المصادر الإسلامية...*",
      initializingSearch: "⏳ بدء البحث... (~{time} ثانية)",
      searchingSources: "🔍 *البحث في المصادر الإسلامية...*"
    },
    errors: {
      audioProcessError: "❌ عذراً، لم أتمكن من معالجة الملف الصوتي. يرجى المحاولة مرة أخرى.",
      transcriptionFailed: "❌ عذراً، لم أتمكن من تحويل الصوت. يرجى إرسال رسالة صوتية أوضح.",
      technicalIssue: "❌ أعتذر، لكنني واجهت مشكلة تقنية أثناء معالجة سؤالك. يرجى المحاولة مرة أخرى بعد قليل.",
      authenticationFailed: "❌ عذراً، واجهت مشكلة في مصادقة المستخدم. يرجى المحاولة لاحقاً."
    },
    buttons: {
      fullResponse: "📚 الإجابة الكاملة والاستشهادات"
    }
  }
};

// Function to get user's language from Telegram data
export function getUserLanguage(telegramLanguageCode?: string): string {
  if (!telegramLanguageCode) return 'en';
  
  // Map Telegram language codes to our supported languages
  const languageMap: Record<string, string> = {
    'ru': 'ru',
    'es': 'es',
    'fr': 'fr',
    'tr': 'tr',
    'ar': 'ar',
    'en': 'en'
  };
  
  // Extract the main language code (e.g., 'en' from 'en-US')
  const mainLanguageCode = telegramLanguageCode.split('-')[0].toLowerCase();
  
  return languageMap[mainLanguageCode] || 'en';
}

// Function to get translations for a specific language
export function getTranslations(languageCode: string): TelegramTranslations {
  return translations[languageCode] || translations['en'];
}

// Helper function to format text with variables
export function formatText(text: string, variables: Record<string, string | number>): string {
  let formattedText = text;
  for (const [key, value] of Object.entries(variables)) {
    formattedText = formattedText.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return formattedText;
} 