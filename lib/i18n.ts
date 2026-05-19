export type Locale = "en" | "es" | "fr" | "pt" | "zh";

// Internal map includes legacy locales so existing data isn't lost
type AnyLocale = Locale | "de" | "ja";

export interface T {
  // Nav
  scanNewTraveler: string;
  searchPlaceholder: string;
  travelersLabel: string;
  noTravelersYet: string;
  uploadToGetStarted: string;
  justNow: string;
  mAgo: (n: number) => string;
  hAgo: (n: number) => string;
  jobLabel: string;          // "Job #"
  unknownClient: string;
  sureDelete: string;
  engineerRole: string;
  language: string;

  // Coworker
  aiCopilot: string;
  liveBadge: string;
  noDocumentBadge: string;
  listeningNow: string;
  askDocPlaceholder: string;
  uploadToStartPlaceholder: string;
  askDocSection: string;
  voiceHint: string;
  keyboardHint: string;
  stopSpeaking: string;
  readAloud: string;
  copilotTitle: string;
  copilotSubtitle: string;
  stop: string;

  // Suggested prompts
  prompts: [string, string, string, string, string, string, string, string];

  // Document Viewer
  originalTab: string;
  analysisTab: string;
  textTab: string;
  fieldsBtn: string;
  aiAnalyzed: string;
  ocrBadge: string;
  dropToReplace: string;
  browseLink: string;
  operationsTab: string;
  risksTab: string;
  summaryLabel: string;
  originalUnavailable: string;
  originalUnavailableDesc: string;
  viewAnalysis: string;
  previewUnavailable: string;

  // Proactive banner
  generateBtn: string;
  dismissBtn: string;
}

const translations: Record<AnyLocale, T> = {
  en: {
    scanNewTraveler: "Scan New Traveler",
    searchPlaceholder: "Search jobs, clients, parts…",
    travelersLabel: "Travelers",
    noTravelersYet: "No travelers yet",
    uploadToGetStarted: "Upload a paper traveler to get started",
    justNow: "just now",
    mAgo: (n) => `${n}m ago`,
    hAgo: (n) => `${n}h ago`,
    jobLabel: "Job #",
    unknownClient: "Unknown Client",
    sureDelete: "sure?",
    engineerRole: "Engineer",
    language: "Language",
    aiCopilot: "Coworker",
    liveBadge: "Claude · Live",
    noDocumentBadge: "No document",
    listeningNow: "Listening — speak now, any language",
    askDocPlaceholder: "Ask your Coworker about this document…",
    uploadToStartPlaceholder: "Upload a document to start…",
    askDocSection: "Ask your Coworker",
    voiceHint: "🎤 Voice · any language — Coworker speaks back automatically",
    keyboardHint: "Shift+Enter new line · Enter to send",
    stopSpeaking: "Stop",
    readAloud: "Read aloud",
    copilotTitle: "Manufacturing Coworker",
    copilotSubtitle: "Upload a traveler, SOP, inspection sheet, or drawing to begin analysis.",
    stop: "Stop",
    prompts: [
      "Summarize this document and flag any issues",
      "What operations are complete and what's still pending?",
      "What signatures are missing?",
      "What specifications apply to this job?",
      "Generate a shift handoff summary",
      "What are the highest quality risks?",
      "What is the material and heat lot?",
      "List all process steps in order",
    ],
    originalTab: "Original",
    analysisTab: "Analysis",
    textTab: "Text",
    fieldsBtn: "Fields",
    aiAnalyzed: "AI Analyzed",
    ocrBadge: "OCR",
    dropToReplace: "Drop another document to replace · or",
    browseLink: "browse",
    operationsTab: "Ops",
    risksTab: "Risks",
    summaryLabel: "Summary",
    originalUnavailable: "Original file not available",
    originalUnavailableDesc: "The original file is only available during the current session. Re-upload to view it again.",
    viewAnalysis: "View Analysis instead →",
    previewUnavailable: "Preview not available for this file type",
    generateBtn: "Generate",
    dismissBtn: "Dismiss",
  },

  es: {
    scanNewTraveler: "Escanear Traveler",
    searchPlaceholder: "Buscar trabajos, clientes, piezas…",
    travelersLabel: "Travelers",
    noTravelersYet: "Sin travelers aún",
    uploadToGetStarted: "Suba un traveler para comenzar",
    justNow: "ahora mismo",
    mAgo: (n) => `hace ${n}m`,
    hAgo: (n) => `hace ${n}h`,
    jobLabel: "Trabajo #",
    unknownClient: "Cliente desconocido",
    sureDelete: "¿seguro?",
    engineerRole: "Ingeniero",
    language: "Idioma",
    aiCopilot: "Coworker",
    liveBadge: "Claude · En vivo",
    noDocumentBadge: "Sin documento",
    listeningNow: "Escuchando — habla ahora, cualquier idioma",
    askDocPlaceholder: "Pregunta al Coworker sobre este documento…",
    uploadToStartPlaceholder: "Sube un documento para comenzar…",
    askDocSection: "Pregunta al Coworker",
    voiceHint: "🎤 Voz · cualquier idioma — Coworker responde automáticamente",
    keyboardHint: "Shift+Enter nueva línea · Enter para enviar",
    stopSpeaking: "Detener",
    readAloud: "Leer en voz alta",
    copilotTitle: "Coworker de Manufactura",
    copilotSubtitle: "Sube un traveler, SOP, hoja de inspección o plano para analizar.",
    stop: "Detener",
    prompts: [
      "Resume este documento e indica los problemas",
      "¿Qué operaciones están completas y cuáles pendientes?",
      "¿Qué firmas faltan?",
      "¿Qué especificaciones aplican a este trabajo?",
      "Genera un resumen de cambio de turno",
      "¿Cuáles son los mayores riesgos de calidad?",
      "¿Cuál es el material y lote de calor?",
      "Lista todos los pasos del proceso en orden",
    ],
    originalTab: "Original",
    analysisTab: "Análisis",
    textTab: "Texto",
    fieldsBtn: "Campos",
    aiAnalyzed: "Analizado por IA",
    ocrBadge: "OCR",
    dropToReplace: "Suelta otro documento para reemplazar · o",
    browseLink: "explorar",
    operationsTab: "Ops",
    risksTab: "Riesgos",
    summaryLabel: "Resumen",
    originalUnavailable: "Archivo original no disponible",
    originalUnavailableDesc: "El archivo original solo está disponible durante la sesión actual. Vuelve a subirlo para verlo.",
    viewAnalysis: "Ver análisis →",
    previewUnavailable: "Vista previa no disponible para este tipo de archivo",
    generateBtn: "Generar",
    dismissBtn: "Cerrar",
  },

  fr: {
    scanNewTraveler: "Scanner un Traveler",
    searchPlaceholder: "Rechercher jobs, clients, pièces…",
    travelersLabel: "Travelers",
    noTravelersYet: "Aucun traveler",
    uploadToGetStarted: "Importez un traveler pour commencer",
    justNow: "à l'instant",
    mAgo: (n) => `il y a ${n}m`,
    hAgo: (n) => `il y a ${n}h`,
    jobLabel: "Job #",
    unknownClient: "Client inconnu",
    sureDelete: "sûr ?",
    engineerRole: "Ingénieur",
    language: "Langue",
    aiCopilot: "Coworker",
    liveBadge: "Claude · En direct",
    noDocumentBadge: "Aucun document",
    listeningNow: "Écoute — parlez maintenant, n'importe quelle langue",
    askDocPlaceholder: "Posez une question au Coworker sur ce document…",
    uploadToStartPlaceholder: "Importez un document pour commencer…",
    askDocSection: "Posez une question au Coworker",
    voiceHint: "🎤 Voix · n'importe quelle langue — Coworker répond automatiquement",
    keyboardHint: "Shift+Entrée nouvelle ligne · Entrée pour envoyer",
    stopSpeaking: "Arrêter",
    readAloud: "Lire à voix haute",
    copilotTitle: "Coworker de Production",
    copilotSubtitle: "Importez un traveler, SOP, fiche d'inspection ou plan pour analyser.",
    stop: "Arrêter",
    prompts: [
      "Résumer ce document et signaler les problèmes",
      "Quelles opérations sont terminées et lesquelles sont en attente ?",
      "Quelles signatures manquent ?",
      "Quelles spécifications s'appliquent à ce travail ?",
      "Générer un résumé de passation de quart",
      "Quels sont les risques qualité les plus élevés ?",
      "Quel est le matériau et le numéro de lot ?",
      "Lister toutes les étapes du processus dans l'ordre",
    ],
    originalTab: "Original",
    analysisTab: "Analyse",
    textTab: "Texte",
    fieldsBtn: "Champs",
    aiAnalyzed: "Analysé par IA",
    ocrBadge: "OCR",
    dropToReplace: "Déposez un document pour remplacer · ou",
    browseLink: "parcourir",
    operationsTab: "Ops",
    risksTab: "Risques",
    summaryLabel: "Résumé",
    originalUnavailable: "Fichier original non disponible",
    originalUnavailableDesc: "Le fichier original n'est disponible que pendant la session. Réimportez-le pour le voir.",
    viewAnalysis: "Voir l'analyse →",
    previewUnavailable: "Aperçu non disponible pour ce type de fichier",
    generateBtn: "Générer",
    dismissBtn: "Fermer",
  },

  de: {
    scanNewTraveler: "Traveler scannen",
    searchPlaceholder: "Jobs, Kunden, Teile suchen…",
    travelersLabel: "Traveler",
    noTravelersYet: "Noch keine Traveler",
    uploadToGetStarted: "Laden Sie einen Traveler hoch, um zu starten",
    justNow: "gerade eben",
    mAgo: (n) => `vor ${n}m`,
    hAgo: (n) => `vor ${n}h`,
    jobLabel: "Job #",
    unknownClient: "Unbekannter Kunde",
    sureDelete: "sicher?",
    engineerRole: "Ingenieur",
    language: "Sprache",
    aiCopilot: "Coworker",
    liveBadge: "Claude · Live",
    noDocumentBadge: "Kein Dokument",
    listeningNow: "Höre zu — sprechen Sie jetzt, jede Sprache",
    askDocPlaceholder: "Fragen Sie den Coworker zu diesem Dokument…",
    uploadToStartPlaceholder: "Laden Sie ein Dokument hoch…",
    askDocSection: "Fragen Sie den Coworker",
    voiceHint: "🎤 Sprache · jede Sprache — Coworker antwortet automatisch",
    keyboardHint: "Shift+Enter neue Zeile · Enter zum Senden",
    stopSpeaking: "Stopp",
    readAloud: "Vorlesen",
    copilotTitle: "Fertigungs-Coworker",
    copilotSubtitle: "Laden Sie einen Traveler, SOP, Prüfbogen oder Zeichnung zur Analyse hoch.",
    stop: "Stopp",
    prompts: [
      "Dieses Dokument zusammenfassen und Probleme markieren",
      "Welche Vorgänge sind abgeschlossen und welche ausstehend?",
      "Welche Unterschriften fehlen?",
      "Welche Spezifikationen gelten für diesen Auftrag?",
      "Schichtübergabe-Zusammenfassung erstellen",
      "Was sind die höchsten Qualitätsrisiken?",
      "Was ist das Material und die Schmelznummer?",
      "Alle Prozessschritte der Reihe nach auflisten",
    ],
    originalTab: "Original",
    analysisTab: "Analyse",
    textTab: "Text",
    fieldsBtn: "Felder",
    aiAnalyzed: "KI-analysiert",
    ocrBadge: "OCR",
    dropToReplace: "Dokument ablegen zum Ersetzen · oder",
    browseLink: "durchsuchen",
    operationsTab: "Ops",
    risksTab: "Risiken",
    summaryLabel: "Zusammenfassung",
    originalUnavailable: "Originaldatei nicht verfügbar",
    originalUnavailableDesc: "Die Originaldatei ist nur während der aktuellen Sitzung verfügbar. Laden Sie sie erneut hoch.",
    viewAnalysis: "Analyse anzeigen →",
    previewUnavailable: "Vorschau für diesen Dateityp nicht verfügbar",
    generateBtn: "Generieren",
    dismissBtn: "Schließen",
  },

  pt: {
    scanNewTraveler: "Escanear Traveler",
    searchPlaceholder: "Buscar trabalhos, clientes, peças…",
    travelersLabel: "Travelers",
    noTravelersYet: "Nenhum traveler ainda",
    uploadToGetStarted: "Carregue um traveler para começar",
    justNow: "agora mesmo",
    mAgo: (n) => `há ${n}m`,
    hAgo: (n) => `há ${n}h`,
    jobLabel: "Job #",
    unknownClient: "Cliente desconhecido",
    sureDelete: "tem certeza?",
    engineerRole: "Engenheiro",
    language: "Idioma",
    aiCopilot: "Coworker",
    liveBadge: "Claude · Ao vivo",
    noDocumentBadge: "Sem documento",
    listeningNow: "Ouvindo — fale agora, qualquer idioma",
    askDocPlaceholder: "Pergunte ao Coworker sobre este documento…",
    uploadToStartPlaceholder: "Carregue um documento para começar…",
    askDocSection: "Pergunte ao Coworker",
    voiceHint: "🎤 Voz · qualquer idioma — Coworker responde automaticamente",
    keyboardHint: "Shift+Enter nova linha · Enter para enviar",
    stopSpeaking: "Parar",
    readAloud: "Ler em voz alta",
    copilotTitle: "Coworker de Manufatura",
    copilotSubtitle: "Carregue um traveler, SOP, folha de inspeção ou desenho para analisar.",
    stop: "Parar",
    prompts: [
      "Resumir este documento e indicar problemas",
      "Quais operações estão completas e quais pendentes?",
      "Quais assinaturas estão faltando?",
      "Quais especificações se aplicam a este trabalho?",
      "Gerar resumo de troca de turno",
      "Quais são os maiores riscos de qualidade?",
      "Qual é o material e lote de calor?",
      "Listar todos os passos do processo em ordem",
    ],
    originalTab: "Original",
    analysisTab: "Análise",
    textTab: "Texto",
    fieldsBtn: "Campos",
    aiAnalyzed: "Analisado por IA",
    ocrBadge: "OCR",
    dropToReplace: "Solte outro documento para substituir · ou",
    browseLink: "procurar",
    operationsTab: "Ops",
    risksTab: "Riscos",
    summaryLabel: "Resumo",
    originalUnavailable: "Arquivo original não disponível",
    originalUnavailableDesc: "O arquivo original está disponível apenas durante a sessão atual. Recarregue para visualizá-lo.",
    viewAnalysis: "Ver análise →",
    previewUnavailable: "Visualização não disponível para este tipo de arquivo",
    generateBtn: "Gerar",
    dismissBtn: "Fechar",
  },

  zh: {
    scanNewTraveler: "扫描新工单",
    searchPlaceholder: "搜索工单、客户、零件…",
    travelersLabel: "工单",
    noTravelersYet: "暂无工单",
    uploadToGetStarted: "上传纸质工单开始使用",
    justNow: "刚刚",
    mAgo: (n) => `${n}分钟前`,
    hAgo: (n) => `${n}小时前`,
    jobLabel: "工号 #",
    unknownClient: "未知客户",
    sureDelete: "确定?",
    engineerRole: "工程师",
    language: "语言",
    aiCopilot: "Coworker",
    liveBadge: "Claude · 在线",
    noDocumentBadge: "无文档",
    listeningNow: "正在听 — 请用任何语言说话",
    askDocPlaceholder: "向 Coworker 询问此文档…",
    uploadToStartPlaceholder: "上传文档开始…",
    askDocSection: "询问 Coworker",
    voiceHint: "🎤 语音 · 任何语言 — Coworker 自动回复",
    keyboardHint: "Shift+Enter 换行 · Enter 发送",
    stopSpeaking: "停止",
    readAloud: "朗读",
    copilotTitle: "制造 Coworker",
    copilotSubtitle: "上传工单、SOP、检验单或图纸开始分析。",
    stop: "停止",
    prompts: [
      "总结此文档并标记问题",
      "哪些工序已完成，哪些待处理？",
      "缺少哪些签名？",
      "此工单适用哪些规范？",
      "生成交接班摘要",
      "最高的质量风险是什么？",
      "材料和热批次是什么？",
      "按顺序列出所有工序步骤",
    ],
    originalTab: "原件",
    analysisTab: "分析",
    textTab: "文本",
    fieldsBtn: "字段",
    aiAnalyzed: "AI已分析",
    ocrBadge: "OCR",
    dropToReplace: "拖放文档以替换 · 或",
    browseLink: "浏览",
    operationsTab: "工序",
    risksTab: "风险",
    summaryLabel: "摘要",
    originalUnavailable: "原始文件不可用",
    originalUnavailableDesc: "原始文件仅在当前会话中可用。重新上传以再次查看。",
    viewAnalysis: "查看分析 →",
    previewUnavailable: "此文件类型不支持预览",
    generateBtn: "生成",
    dismissBtn: "关闭",
  },

  ja: {
    scanNewTraveler: "新規トラベラースキャン",
    searchPlaceholder: "ジョブ、顧客、部品を検索…",
    travelersLabel: "トラベラー",
    noTravelersYet: "トラベラーなし",
    uploadToGetStarted: "トラベラーをアップロードして開始",
    justNow: "たった今",
    mAgo: (n) => `${n}分前`,
    hAgo: (n) => `${n}時間前`,
    jobLabel: "ジョブ #",
    unknownClient: "不明なクライアント",
    sureDelete: "確認?",
    engineerRole: "エンジニア",
    language: "言語",
    aiCopilot: "Coworker",
    liveBadge: "Claude · ライブ",
    noDocumentBadge: "文書なし",
    listeningNow: "聞いています — 今話してください（任意の言語）",
    askDocPlaceholder: "この文書について Coworker に質問…",
    uploadToStartPlaceholder: "文書をアップロードして開始…",
    askDocSection: "Coworker に質問",
    voiceHint: "🎤 音声・任意言語 — Coworker が自動で返答",
    keyboardHint: "Shift+Enter 改行 · Enter 送信",
    stopSpeaking: "停止",
    readAloud: "読み上げ",
    copilotTitle: "製造 Coworker",
    copilotSubtitle: "分析するトラベラー、SOP、検査シート、または図面をアップロード。",
    stop: "停止",
    prompts: [
      "この文書を要約して問題を指摘",
      "完了した作業と保留中の作業は？",
      "不足している署名は？",
      "このジョブに適用される仕様は？",
      "シフト引継ぎサマリーを生成",
      "最大の品質リスクは？",
      "材料とヒートロットは？",
      "全工程ステップを順に一覧表示",
    ],
    originalTab: "原本",
    analysisTab: "分析",
    textTab: "テキスト",
    fieldsBtn: "フィールド",
    aiAnalyzed: "AI分析済",
    ocrBadge: "OCR",
    dropToReplace: "文書をドロップして置き換え · または",
    browseLink: "参照",
    operationsTab: "作業",
    risksTab: "リスク",
    summaryLabel: "サマリー",
    originalUnavailable: "元ファイルは利用できません",
    originalUnavailableDesc: "元ファイルは現在のセッション中のみ利用可能です。再アップロードして表示。",
    viewAnalysis: "分析を表示 →",
    previewUnavailable: "このファイルタイプはプレビュー不可",
    generateBtn: "生成",
    dismissBtn: "閉じる",
  },
};

export const LOCALES: { code: Locale; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "fr", flag: "🇫🇷", label: "FR" },
  { code: "pt", flag: "🇧🇷", label: "PT" },
  { code: "zh", flag: "🇨🇳", label: "ZH" },
];

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  zh: "Chinese",
};

const VALID_LOCALES: Locale[] = ["en", "es", "fr", "pt", "zh"];

export function isValidLocale(l: string): l is Locale {
  return VALID_LOCALES.includes(l as Locale);
}

export function t(locale: Locale): T {
  return translations[locale];
}
