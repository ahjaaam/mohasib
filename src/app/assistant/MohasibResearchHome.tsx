"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpenText, Building2, ChevronDown, Copy, ExternalLink, FileText, Landmark, LoaderCircle, Mic, MicOff, Paperclip, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import styles from "./assistant.module.css";

type SpeechResult = { 0: { transcript: string }; length: number };
type SpeechRecognitionEventLike = Event & { results: ArrayLike<SpeechResult> };
type SpeechRecognitionErrorLike = Event & { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

type Citation = {
  id: string;
  title: string;
  url: string;
  domain: string;
  trust: "official" | "professional" | "academic" | "web";
  excerpts: string[];
};

type Answer = { status: "answered" | "no_sources" | "no_support" | "out_of_scope"; answer: string; citations: Citation[]; as_of: string };

function SourceFavicon({ domain }: { domain: string }) {
  const [available, setAvailable] = useState(true);
  if (!available || !domain) return null;
  return (
    // External favicons are displayed directly; they are not routed through Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.sourceFavicon} src={`https://${domain}/favicon.ico`} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setAvailable(false)} />
  );
}

function AnswerContent({ text }: { text: string }) {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/\s+(?=[1-6][.)]\s+)/g, "\n")
    .replace(/\s+(?=(?:À vérifier|À préciser|Point de situation)\s*:)/gi, "\n");
  const sourceLines = normalized
    .replace(/\s+(?=[-*•]\s+)/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = sourceLines.reduce<string[]>((result, sourceLine) => {
    const year = sourceLine.match(/^(20\d{2})[.:]?$/);
    if (year && result.length) {
      result[result.length - 1] = `${result[result.length - 1]} ${year[1]}`;
    } else if (/^:$/.test(sourceLine) && result.at(-1)?.match(/20\d{2}$/)) {
      return result;
    } else if (/^[,;:]/.test(sourceLine) && result.length) {
      result[result.length - 1] = `${result[result.length - 1]}${sourceLine}`;
    } else {
      result.push(sourceLine);
    }
    return result;
  }, []);
  const inline = (value: string) => {
    return value.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\\([*_`])/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
  };

  return <div className={styles.answerCopy}>{lines.map((rawLine, index) => {
    const line = rawLine.replace(/^>\s?/, "").replace(/(^|[•\s])\*([^*\n]+)\*\*(?=\s|$)/g, "$1**$2**");
    if (/^(?:[•*-]\s*)?$/.test(line) || /^[-*_]{2,}$/.test(line) || /^[•*-]\s*[-*_]{2,}$/.test(line)) return null;
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) return <h3 className={styles.answerSubheading} key={`${index}-${line}`}>{inline(heading[1])}</h3>;
    const ordered = line.match(/^([1-6])[.)]\s+(.+)$/);
    const unordered = line.match(/^(?:[-*•])\s+(.+)$/);
    const isNote = /^(?:À vérifier|À préciser|Point de situation)\s*:/i.test(line);
    if (ordered || unordered) {
      const content = ordered?.[2] ?? unordered?.[1] ?? line;
      const marker = ordered?.[1] ?? "•";
      return <div className={styles.answerPoint} key={`${index}-${line}`}><span aria-hidden="true">{marker}</span><p>{inline(content)}</p></div>;
    }
    if (isNote) return <p className={styles.answerNote} key={`${index}-${line}`}>{inline(line)}</p>;
    return <p className={styles.answerParagraph} key={`${index}-${line}`}>{inline(line)}</p>;
  })}</div>;
}

const QUESTION_EXAMPLES = [
  "Quelle loi encadre la comptabilité des commerçants ?",
  "Comment calculer la TVA déductible ?",
  "Quelles obligations pour une SARL au Maroc ?",
  "Comment déclarer un salarié à la CNSS ?",
];

export default function MohasibResearchHome() {
  const [question, setQuestion] = useState("");
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [copiedResearchNote, setCopiedResearchNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [listening, setListening] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionBase = useRef("");

  async function copyResearchNote() {
    if (!answer) return;
    const sources = answer.citations.map((source) => {
      const authority = source.trust === "official" ? "Source officielle" : source.trust === "professional" ? "Source professionnelle" : source.trust === "academic" ? "Source universitaire" : "Source web";
      const excerpts = source.excerpts.length ? source.excerpts.map((excerpt) => `Passage retourné par la recherche : « ${excerpt} »`).join("\n") : "Aucun extrait n’a été retourné par la recherche.";
      return `${source.title}\n${source.domain} · ${authority}\n${source.url}\nDate de publication : non indiquée dans les données reçues.\n${excerpts}`;
    });
    const note = `Question\n${question}\n\nRéponse de recherche\n${answer.answer}\n\nSources\n${sources.join("\n\n")}\n\nRecherche effectuée le ${answer.as_of}. Les extraits sont ceux renvoyés avec les citations; vérifier le passage et sa version dans le texte source avant réutilisation.`;
    try {
      await navigator.clipboard.writeText(note);
      setCopiedResearchNote(true);
      window.setTimeout(() => setCopiedResearchNote(false), 1800);
    } catch {
      setCopiedResearchNote(false);
    }
  }

  useEffect(() => () => recognitionRef.current?.stop(), []);

  useEffect(() => {
    if (question) {
      setAnimatedPlaceholder("");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimatedPlaceholder(QUESTION_EXAMPLES[0]);
      return;
    }

    let exampleIndex = 0;
    let characterCount = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const animate = () => {
      const example = QUESTION_EXAMPLES[exampleIndex];
      if (!deleting) {
        characterCount += 1;
        setAnimatedPlaceholder(example.slice(0, characterCount));
        if (characterCount === example.length) {
          deleting = true;
          timeout = setTimeout(animate, 1100);
          return;
        }
        timeout = setTimeout(animate, 20);
        return;
      }

      characterCount -= 1;
      setAnimatedPlaceholder(example.slice(0, characterCount));
      if (characterCount === 0) {
        deleting = false;
        exampleIndex = (exampleIndex + 1) % QUESTION_EXAMPLES.length;
        timeout = setTimeout(animate, 220);
        return;
      }
      timeout = setTimeout(animate, 10);
    };

    timeout = setTimeout(animate, 350);
    return () => clearTimeout(timeout);
  }, [question]);

  function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion(question);
  }

  async function askQuestion(value: string) {
    const cleanQuestion = value.trim();
    if (cleanQuestion.length < 5 || loading) return;
    recognitionRef.current?.stop();
    setListening(false);
    setQuestion(cleanQuestion);
    setLoading(true);
    setError("");
    setAnswer(null);
    setExpandedSource(null);
    try {
      const request = attachments.length ? (() => {
        const form = new FormData();
        form.set("question", cleanQuestion);
        attachments.forEach((file) => form.append("files", file));
        return fetch("/api/assistant/answer", { method: "POST", body: form });
      })() : fetch("/api/assistant/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion }),
      });
      const response = await request;
      const responseText = await response.text();
      let json: { error?: string } & Partial<Answer>;
      try {
        if (!responseText.trim()) throw new Error("empty");
        json = JSON.parse(responseText) as { error?: string } & Partial<Answer>;
      } catch {
        throw new Error(`Le serveur a renvoyé une réponse invalide (HTTP ${response.status}). Réessayez; si le problème persiste, vérifiez les journaux du serveur.`);
      }
      if (!response.ok) throw new Error(json.error || "La recherche a échoué.");
      if (typeof json.answer !== "string" || !Array.isArray(json.citations)) {
        throw new Error("La réponse du serveur ne contient pas les champs attendus. Réessayez.");
      }
      setAnswer(json as Answer);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Le serveur de l’assistant est injoignable. Vérifiez qu’il fonctionne, puis réessayez." : requestError instanceof Error ? requestError.message : "La recherche a échoué.");
    } finally {
      setLoading(false);
    }
  }

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const speech = window as SpeechWindow;
    const Recognition = speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
    if (!Recognition) {
      setError("La dictée vocale n’est pas disponible dans ce navigateur. Vous pouvez utiliser la dictée intégrée à votre clavier.");
      return;
    }
    setError("");
    const recognition = new Recognition();
    recognition.lang = "fr-MA";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionBase.current = question.trim();
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
      setQuestion([recognitionBase.current, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(event.error === "not-allowed" ? "Autorisez l’accès au microphone dans votre navigateur pour dicter." : "La dictée vocale a été interrompue. Réessayez.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("Impossible de démarrer la dictée vocale.");
    }
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const accepted = Array.from(files);
    const next = [...attachments, ...accepted].slice(0, 3);
    if (accepted.some((file) => file.size > 10 * 1024 * 1024) || next.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
      setError("Chaque fichier doit faire moins de 10 Mo; trois fichiers et 20 Mo au total maximum.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setError("");
    setAttachments(next);
    if (accepted.length + attachments.length > 3) setError("Vous pouvez joindre jusqu’à 3 fichiers par question.");
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Mohasib Biblio, accueil">
          <Image src="/favicon-gold.png" alt="" width={40} height={40} priority />
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandName}>Biblio</span>
        </Link>
        <Link href="/connexion" className={styles.login}>Se connecter</Link>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <h1 id="hero-title">Une question métier. Une réponse fiable.</h1>
        <div className={styles.topicBadges} aria-label="Domaines couverts">
          {[
            { label: "Comptabilité", icon: <BookOpenText size={14} aria-hidden="true" /> },
            { label: "Fiscalité", icon: <Landmark size={14} aria-hidden="true" /> },
            { label: "Obligations des sociétés", icon: <Building2 size={14} aria-hidden="true" /> },
            { label: "Paie", icon: <Wallet size={14} aria-hidden="true" /> },
            { label: "CNSS au Maroc", icon: <ShieldCheck size={14} aria-hidden="true" /> },
          ].map(({ label, icon }) => (
            <span className={styles.topicBadge} key={label}>{icon}{label}</span>
          ))}
        </div>

        <form className={styles.searchBox} onSubmit={ask}>
          <label className={styles.srOnly} htmlFor="professional-question">Votre question comptable ou fiscale</label>
          <textarea
            id="professional-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onInput={(event) => {
              const textarea = event.currentTarget;
              textarea.style.height = "auto";
              textarea.style.height = `${textarea.scrollHeight}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={animatedPlaceholder}
            rows={2}
          />
          <div className={styles.composerTools}>
            <input ref={fileInput} className={styles.srOnly} type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,text/plain,text/csv" onChange={(event) => addFiles(event.currentTarget.files)} aria-label="Joindre des fichiers" />
            <button className={styles.toolButton} type="button" onClick={() => fileInput.current?.click()} aria-label="Joindre un fichier" title="Joindre des fichiers"><Paperclip size={16} /><span>Joindre</span></button>
            <button className={`${styles.toolButton} ${listening ? styles.toolButtonActive : ""}`} type="button" onClick={toggleDictation} aria-label={listening ? "Arrêter la dictée" : "Dicter la question"} title={listening ? "Arrêter la dictée" : "Dicter la question"}>{listening ? <MicOff size={16} /> : <Mic size={16} />}<span>{listening ? "Écoute…" : "Dicter"}</span></button>
            <details className={styles.modeDropdown}>
              <summary className={styles.modeSummary}>Réponse rapide <ChevronDown size={14} aria-hidden="true" /></summary>
              <div className={styles.modeMenu}>
                <div className={styles.modeOptionCurrent} aria-current="true">Réponse rapide <span>Actuelle</span></div>
                <button className={styles.modeOptionDisabled} type="button" disabled title="Disponible prochainement">
                  Réponse détaillée <span className={styles.comingSoon}>Bientôt</span>
                </button>
              </div>
            </details>
          </div>
          <button className={styles.submit} type="submit" aria-label="Rechercher" disabled={loading}>{loading ? <LoaderCircle size={19} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={2.5} />}</button>
        </form>

        {attachments.length > 0 && <><div className={styles.attachmentList} aria-label="Fichiers joints">{attachments.map((file, index) => <span className={styles.attachmentChip} key={`${file.name}-${file.lastModified}-${index}`}><FileText size={14} /><span>{file.name}</span><button type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Retirer ${file.name}`}><X size={13} /></button></span>)}</div><p className={styles.dictationHint}>Le texte extrait accompagne cette question uniquement; il n’est pas réutilisé pour d’autres réponses.</p></>}
        {listening && <p className={styles.dictationHint} aria-live="polite">La dictée utilise la reconnaissance vocale du navigateur; seul le texte transcrit accompagne la question.</p>}


        {error && <div className={styles.notice} role="alert"><Sparkles size={16} />{error}{error.includes("Connectez-vous") && <Link href="/connexion">Se connecter</Link>}</div>}

        {loading && <div className={styles.loading}><LoaderCircle size={16} className="animate-spin" /> Recherche sur le web et préparation de la réponse…</div>}

        {answer && (
          <section className={styles.results} aria-live="polite" aria-label="Réponse et recherche documentaire">
            <article className={styles.answer} aria-labelledby="answer-title">
              <h2 id="answer-title">{answer.status === "answered" ? "Réponse" : answer.status === "out_of_scope" ? "Thèmes couverts" : "Réponse non établie"}</h2>
              <AnswerContent text={answer.answer} />
              <footer className={styles.answerFooter}>Date de référence : {answer.as_of}</footer>
            </article>

            <aside className={styles.researchCard} aria-labelledby="research-title">
              <div className={styles.researchHeader}>
                <div><h2 id="research-title">Sources de la réponse</h2></div>
                <button className={styles.copyResearchButton} type="button" onClick={() => void copyResearchNote()} disabled={!answer.citations.length}>
                  <Copy size={14} aria-hidden="true" />{copiedResearchNote ? "Copiée" : "Copier la note"}
                </button>
              </div>
              {answer.citations.length ? <>
                <div className={styles.sourceList}>
                  {answer.citations.map((source) => (
                    <article className={styles.source} key={source.id}>
                      {(source.trust === "professional" || source.trust === "academic") && <div className={styles.sourceTrust}>
                        <span className={styles.authorityTag}>{source.trust === "professional" ? "Ordre professionnel identifié" : "Domaine universitaire (.ac.ma)"}</span>
                      </div>}
                      <button className={styles.sourceToggle} type="button" aria-expanded={expandedSource === source.id} onClick={() => setExpandedSource(expandedSource === source.id ? null : source.id)}>
                        <span className={styles.sourceInfo}><strong>{source.title}</strong><small><SourceFavicon domain={source.domain} />{source.domain}</small></span>
                        <ChevronDown size={17} className={expandedSource === source.id ? styles.chevronOpen : ""} />
                      </button>
                      {expandedSource === source.id && <div className={styles.sourceDetail}>
                        <p className={styles.sourceAuthority}>{source.trust === "official" ? "Source officielle marocaine" : source.trust === "professional" ? "Source professionnelle" : source.trust === "academic" ? "Source universitaire" : "Source web"}</p>
                        <p className={styles.excerptLabel}>Passage retourné avec la citation</p>
                        {source.excerpts.length ? source.excerpts.map((excerpt, index) => <blockquote className={styles.sourceExcerpt} key={`${source.id}-${index}`}>{excerpt}</blockquote>) : <p>Aucun extrait de page n’a été retourné; vérifiez directement le contenu de la source.</p>}
                        <p className={styles.sourcePublicationDate}>Date de publication non fournie par la recherche.</p>
                        <a href={source.url} target="_blank" rel="noreferrer">Ouvrir cette page <ExternalLink size={13} /></a>
                      </div>}
                    </article>
                  ))}
                </div>
              </> : <p className={styles.noSources}>Aucune ressource web n’a été citée pour cette réponse.</p>}
              <p className={styles.asOfNote}>Recherche effectuée pour la date du {answer.as_of}.</p>
            </aside>
          </section>
        )}
      </section>
    </main>
  );
}
