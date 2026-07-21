"use client";

import { animate, stagger } from "animejs";
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  BrainCircuit,
  Check,
  Copy,
  Cpu,
  Mic,
  Network,
  Radio,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductKind, ProductScene } from "./ProductScene";
import {
  calculateRms,
  createSilenceDetectorState,
  SILENCE_TIMEOUT_MS,
  updateSilenceDetector,
} from "./silence-detector";
import { runVoiceChat } from "./voice-client";

type Language = "en" | "hy";

const LANGUAGE_KEY = "armenian-ai-language";

const voiceErrorCopy = {
  en: {
    microphone: "The microphone could not be started. Check the browser permission and try again.",
    connection: "The model did not return an answer. Check that Lightning AI is running and try again.",
    configuration: "The Lightning AI model address has not been connected yet.",
  },
  hy: {
    microphone: "Չհաջողվեց միացնել խոսափողը։ Ստուգեք թույլտվությունը և կրկին փորձեք։",
    connection: "Մոդելը պատասխան չտվեց։ Ստուգեք, որ Lightning AI-ն միացված է, և կրկին փորձեք։",
    configuration: "Lightning AI մոդելի հասցեն դեռ միացված չէ։",
  },
} as const;

const shared = {
  en: {
    nav: { home: "Home", voice: "Voice", ai: "AI", api: "API" },
    language: "Language",
    local: "Local prototype",
    explore: "Explore",
    footer: "Armenian AI · Built for Armenian conversations",
  },
  hy: {
    nav: { home: "Գլխավոր", voice: "Ձայն", ai: "Բանականություն", api: "API" },
    language: "Լեզու",
    local: "Տեղային նախատիպ",
    explore: "Բացել",
    footer: "Armenian AI · Խոսում է ձեր լեզվով",
  },
} as const;

const pageCopy = {
  home: {
    en: {
      kicker: "Armenian technology, without translation",
      title: "AI that starts with Armenian.",
      body: "A voice-first product for natural Armenian conversations — designed for people, businesses, and the products they use every day.",
      primary: "Open voice demo",
      secondary: "See the platform",
      chapter: "Three products. One Armenian foundation.",
      cards: [
        ["Voice", "Speak naturally and receive a spoken Armenian answer.", "/voice", "01"],
        ["Intelligence", "Understand meaning, context, and real conversational intent.", "/ai", "02"],
        ["API", "Bring Armenian conversation into your own product.", "/api", "03"],
      ],
    },
    hy: {
      kicker: "Հայերեն AI",
      title: "AI, որ խոսում է հայերեն։",
      body: "Խոսեք բնական․ ձեզ կհասկանան ու կպատասխանեն հայերեն։",
      primary: "Խոսել",
      secondary: "Հարթակը",
      chapter: "Երեք գործիք, մեկ լեզու։",
      cards: [
        ["Ձայն", "Խոսում եք, պատասխանը հնչում է հայերեն։", "/voice", "01"],
        ["Բանականություն", "Հասկանում է ասելիքը, ոչ միայն բառերը։", "/ai", "02"],
        ["API", "Հայերեն զրույցը՝ ձեր արտադրանքում։", "/api", "03"],
      ],
    },
  },
  voice: {
    en: {
      kicker: "Armenian voice conversation",
      title: "Press once. Speak. Get an answer.",
      body: "No technical panels and no model settings. Just a direct Armenian conversation.",
      ready: "Ready to listen",
      listen: "Start speaking",
      stop: "Finish question",
      thinking: "Preparing an Armenian answer…",
      heard: "You said",
      answer: "Armenian AI",
      autoStop: "Recording stops after a short silence",
      history: "Conversation history",
      replay: "Replay answer",
      copy: "Copy answer",
      copied: "Copied",
      clear: "Clear history",
      chapter: "A conversation, not a dashboard.",
      points: ["One clear action", "Armenian speech from start to finish", "Designed for everyday questions"],
    },
    hy: {
      kicker: "Հայերեն զրույց",
      title: "Սեղմեք։ Խոսեք։ Ստացեք պատասխան։",
      body: "Առանց կարգավորումների՝ պարզապես խոսեք հայերեն։",
      ready: "Պատրաստ եմ լսել",
      listen: "Խոսել",
      stop: "Ավարտել",
      thinking: "Մտածում եմ…",
      heard: "Դուք ասացիք",
      answer: "Armenian AI",
      autoStop: "Ձայնագրումը կդադարի կարճ լռությունից հետո",
      history: "Զրույցի պատմություն",
      replay: "Կրկին լսել",
      copy: "Պատճենել պատասխանը",
      copied: "Պատճենված է",
      clear: "Մաքրել պատմությունը",
      chapter: "Զրույց, ոչ թե վահանակ։",
      points: ["Մեկ սեղմում", "Ամբողջովին հայերեն", "Առօրյա հարցերի համար"],
    },
  },
  ai: {
    en: {
      kicker: "Language intelligence",
      title: "Understand what Armenians mean — not only what they say.",
      body: "Armenian AI is designed around conversational context, natural phrasing, and the way real people move between formal and everyday language.",
      label: "Language fabric",
      chapter: "Meaning is built between the words.",
      features: [
        ["Context", "Follow the direction of a conversation instead of treating every sentence alone."],
        ["Natural Armenian", "Respond with language that feels direct, clear, and locally familiar."],
        ["Business awareness", "Shape the conversation around the service, customer, and situation."],
      ],
      cta: "Try the voice experience",
    },
    hy: {
      kicker: "Լեզվային բանականություն",
      title: "Հասկանում է ասելիքը, ոչ միայն բառերը։",
      body: "Հետևում է զրույցի թելին և ազատ անցնում առօրյա ու պաշտոնական հայերենի միջև։",
      label: "Նեյրոնային ցանց",
      chapter: "Իմաստը՝ բառերի արանքում։",
      features: [
        ["Համատեքստ", "Հիշում է զրույցի թելը և չի կորցնում այն։"],
        ["Բնական հայերեն", "Խոսում է պարզ ու հարազատ, առանց արհեստականության։"],
        ["Բիզնեսի համար", "Հարմարվում է ձեր ծառայությանն ու հաճախորդին։"],
      ],
      cta: "Փորձել ձայնով",
    },
  },
  api: {
    en: {
      kicker: "Developer access · design preview",
      title: "Connect Armenian conversation to your product.",
      body: "A future interface for websites, mobile apps, and call systems. This page presents the product direction; API access is not active yet.",
      status: "Private design preview",
      chapter: "One clean connection layer.",
      steps: [
        ["01", "Send conversation", "Audio or Armenian text enters through one product interface."],
        ["02", "Receive meaning", "The response returns in a predictable application-friendly shape."],
        ["03", "Choose the experience", "Use text, voice, or both inside your own interface."],
      ],
      note: "No API keys are issued in this local prototype.",
    },
    hy: {
      kicker: "Մշակողների համար · նախադիտում",
      title: "Հայերեն զրույցը՝ ձեր արտադրանքում։",
      body: "Մեկ միջերես՝ կայքերի, հավելվածների ու զանգերի համար։ API-ն դեռ ակտիվ չէ։",
      status: "Փակ նախադիտում",
      chapter: "Մեկ պարզ միացում։",
      steps: [
        ["01", "Ուղարկեք", "Ձայն կամ տեքստ՝ մեկ հարցումով։"],
        ["02", "Ստացեք", "Պատասխանը՝ մշակողին հարմար ձևաչափով։"],
        ["03", "Ընտրեք", "Տեքստ, ձայն կամ երկուսը միասին։"],
      ],
      note: "Փորձնական տարբերակում API բանալիներ չեն տրամադրվում։",
    },
  },
} as const;

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Armenian AI home">
      <span>Armenian <b>AI</b></span>
    </Link>
  );
}

function Header({ kind, language, setLanguage }: { kind: ProductKind; language: Language; setLanguage: (language: Language) => void }) {
  const s = shared[language];
  const links = [
    ["home", "/", s.nav.home],
    ["voice", "/voice", s.nav.voice],
    ["ai", "/ai", s.nav.ai],
    ["api", "/api", s.nav.api],
  ] as const;

  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Primary navigation">
        {links.map(([route, href, label]) => (
          <Link key={route} className={kind === route ? "active" : ""} href={href}>{label}</Link>
        ))}
      </nav>
      <div className="header-tools">
        <span className="local-badge"><i />{s.local}</span>
        <div className="language-switch" aria-label={s.language}>
          <button className={language === "hy" ? "active" : ""} onClick={() => setLanguage("hy")}>HY</button>
          <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
        </div>
      </div>
    </header>
  );
}

type ConversationTurn = {
  id: string;
  transcript: string;
  answer: string;
  audioUrl: string;
};

function VoiceConsole({ language, onState }: { language: Language; onState: (listening: boolean, thinking: boolean) => void }) {
  const copy = pageCopy.voice[language];
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const startingRef = useRef(false);
  const [status, setStatus] = useState<"ready" | "listening" | "thinking">("ready");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const stopSilenceMonitor = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    audioSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioSourceRef.current = null;
    analyserRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopSilenceMonitor();
    setStatus("thinking");
    onState(false, true);
    recorder.stop();
  }, [onState, stopSilenceMonitor]);

  const startSilenceMonitor = useCallback((stream: MediaStream) => {
    stopSilenceMonitor();

    try {
      const AudioContextConstructor = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;

      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.15;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      audioSourceRef.current = source;
      analyserRef.current = analyser;
      void audioContext.resume().catch(() => undefined);

      const samples = new Uint8Array(analyser.fftSize);
      let detectorState = createSilenceDetectorState();

      const inspectAudio = (now: number) => {
        if (recorderRef.current?.state !== "recording") return;
        analyser.getByteTimeDomainData(samples);
        const update = updateSilenceDetector(detectorState, calculateRms(samples), now);
        detectorState = update.state;

        if (update.shouldStop) {
          stopRecording();
          return;
        }

        animationFrameRef.current = window.requestAnimationFrame(inspectAudio);
      };

      animationFrameRef.current = window.requestAnimationFrame(inspectAudio);
    } catch {
      stopSilenceMonitor();
    }
  }, [stopRecording, stopSilenceMonitor]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      stopSilenceMonitor();
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      playbackRef.current?.pause();
      onState(false, false);
    };
  }, [onState, stopSilenceMonitor]);

  const playAnswer = useCallback((audioUrl: string) => {
    playbackRef.current?.pause();
    const audio = new Audio(audioUrl);
    playbackRef.current = audio;
    void audio.play().catch(() => {
    });
  }, []);

  const copyAnswer = useCallback((turn: ConversationTurn) => {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(turn.answer).then(() => {
      if (!mountedRef.current) return;
      setCopiedId(turn.id);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1800);
    }).catch(() => undefined);
  }, []);

  const clearHistory = useCallback(() => {
    playbackRef.current?.pause();
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    setHistory([]);
    setTranscript("");
    setAnswer("");
    setCopiedId(null);
  }, []);

  const complete = useCallback(async (audioBlob: Blob) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const result = await runVoiceChat(audioBlob);
      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      const turn: ConversationTurn = {
        id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${requestId}`,
        transcript: result.transcript,
        answer: result.answer,
        audioUrl: result.audioUrl,
      };
      setTranscript(result.transcript);
      setAnswer(result.answer);
      setHistory((current) => [turn, ...current]);
      playAnswer(result.audioUrl);
    } catch (error) {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;

      const message = error instanceof Error ? error.message : "";
      const isConfigurationError = message === "LIGHTNING_URL_MISSING" || message === "LIGHTNING_URL_INVALID";
      setAnswer(isConfigurationError ? voiceErrorCopy[language].configuration : voiceErrorCopy[language].connection);
    } finally {
      if (!mountedRef.current || requestIdRef.current !== requestId) return;
      setStatus("ready");
      onState(false, false);
    }
  }, [language, onState, playAnswer]);

  const start = async () => {
    if (status !== "ready" || startingRef.current) return;
    startingRef.current = true;
    setTranscript("");
    setAnswer("");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("MICROPHONE_UNAVAILABLE");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const preferredMimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        stopSilenceMonitor();
        chunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setAnswer(voiceErrorCopy[language].microphone);
        setStatus("ready");
        onState(false, false);
      };
      recorder.onstop = () => {
        stopSilenceMonitor();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || preferredMimeType || "audio/webm",
        });
        chunksRef.current = [];
        void complete(audioBlob);
      };

      recorder.start();
      startSilenceMonitor(stream);
      setStatus("listening");
      onState(true, false);
    } catch {
      stopSilenceMonitor();
      if (mountedRef.current) {
        setAnswer(voiceErrorCopy[language].microphone);
        setStatus("ready");
        onState(false, false);
      }
    } finally {
      startingRef.current = false;
    }
  };

  return (
    <div className="voice-workspace">
      <div className={`voice-console state-${status}`}>
        <div className="voice-console-head">
          <span><i />{status === "listening" ? copy.stop : status === "thinking" ? copy.thinking : copy.ready}</span>
        </div>
        <button
          className="voice-action"
          type="button"
          disabled={status === "thinking"}
          onClick={status === "listening" ? stopRecording : start}
          aria-label={status === "listening" ? copy.stop : copy.listen}
        >
          {status === "thinking" ? <Sparkles /> : <Mic />}
          <span>{status === "listening" ? copy.stop : status === "thinking" ? copy.thinking : copy.listen}</span>
        </button>
        <div className="console-wave" aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--index": index } as React.CSSProperties} />)}
        </div>
        {status === "listening" ? <p className="auto-stop-hint">{copy.autoStop} · {SILENCE_TIMEOUT_MS / 1000}s</p> : null}
        {(transcript || answer) ? (
          <div className="dialogue" aria-live="polite">
            {transcript ? <p><span>{copy.heard}</span>{transcript}</p> : null}
            {answer ? <p className="ai-answer"><span>{copy.answer}</span>{answer}</p> : null}
          </div>
        ) : null}
      </div>

      {history.length > 0 ? (
        <section className="conversation-history" aria-labelledby="conversation-history-title">
          <div className="history-head">
            <div>
              <span>{String(history.length).padStart(2, "0")}</span>
              <h2 id="conversation-history-title">{copy.history}</h2>
            </div>
            <button type="button" onClick={clearHistory}><Trash2 />{copy.clear}</button>
          </div>
          <div className="history-list">
            {history.map((turn, index) => (
              <article className="history-turn" key={turn.id}>
                <span className="history-index">{String(history.length - index).padStart(2, "0")}</span>
                <div className="history-copy">
                  <p><span>{copy.heard}</span>{turn.transcript}</p>
                  <p className="history-answer"><span>{copy.answer}</span>{turn.answer}</p>
                </div>
                <div className="history-actions">
                  <button type="button" onClick={() => playAnswer(turn.audioUrl)} aria-label={copy.replay}><Volume2 />{copy.replay}</button>
                  <button type="button" onClick={() => copyAnswer(turn)} aria-label={copy.copy}><Copy />{copiedId === turn.id ? copy.copied : copy.copy}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HomePage({ language }: { language: Language }) {
  const copy = pageCopy.home[language];
  return (
    <>
      <section className="route-hero home-hero">
        <div className="hero-content">
          <div className="kicker reveal"><Sparkles />{copy.kicker}</div>
          <h1 className="reveal">{copy.title}</h1>
          <p className="reveal">{copy.body}</p>
          <div className="hero-actions reveal">
            <Link className="button button-primary" href="/voice"><Mic />{copy.primary}</Link>
            <a className="text-link" href="#platform">{copy.secondary}<ArrowRight /></a>
          </div>
        </div>
      </section>
      <section id="platform" className="home-products content-section">
        <div className="section-heading">
          <span>Armenian AI / 2026</span>
          <h2>{copy.chapter}</h2>
        </div>
        <div className="product-links">
          {copy.cards.map(([title, body, href, number]) => (
            <Link href={href} key={href}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
              <ArrowUpRight />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function VoicePage({ language, onState }: { language: Language; onState: (listening: boolean, thinking: boolean) => void }) {
  const copy = pageCopy.voice[language];
  return (
    <>
      <section className="route-hero voice-hero">
        <div className="voice-title-block">
          <div className="kicker reveal"><Volume2 />{copy.kicker}</div>
          <h1 className="reveal">{copy.title}</h1>
          <p className="reveal">{copy.body}</p>
        </div>
        <VoiceConsole language={language} onState={onState} />
      </section>
      <section className="voice-principles content-section">
        <div className="section-heading"><span>Voice / experience</span><h2>{copy.chapter}</h2></div>
        <div className="principle-list">
          {copy.points.map((point, index) => <article key={point}><b>0{index + 1}</b><h3>{point}</h3><Check /></article>)}
        </div>
      </section>
    </>
  );
}

function AiPage({ language }: { language: Language }) {
  const copy = pageCopy.ai[language];
  return (
    <>
      <section className="route-hero ai-hero">
        <div className="ai-index reveal">A/02</div>
        <div className="ai-copy">
          <div className="kicker reveal"><BrainCircuit />{copy.kicker}</div>
          <h1 className="reveal">{copy.title}</h1>
          <p className="reveal">{copy.body}</p>
          <span className="loom-label reveal"><i />{copy.label}</span>
        </div>
      </section>
      <section className="ai-features content-section">
        <div className="section-heading"><span>Meaning / context</span><h2>{copy.chapter}</h2></div>
        <div className="feature-stack">
          {copy.features.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
        </div>
        <Link className="button ai-button" href="/voice">{copy.cta}<ArrowRight /></Link>
      </section>
    </>
  );
}

function ApiPage({ language }: { language: Language }) {
  const copy = pageCopy.api[language];
  return (
    <>
      <section className="route-hero api-hero">
        <div className="api-copy">
          <div className="kicker reveal"><Braces />{copy.kicker}</div>
          <h1 className="reveal">{copy.title}</h1>
          <p className="reveal">{copy.body}</p>
          <span className="api-status reveal"><i />{copy.status}</span>
        </div>
        <div className="code-panel reveal" aria-label="API design example">
          <div className="code-panel-head"><span /><span /><span /><b>conversation.request</b></div>
          <pre><code>{`POST /v1/conversation\n{\n  "language": "hy-AM",\n  "input": "voice",\n  "response": ["text", "voice"]\n}`}</code></pre>
          <div className="code-response"><Check />200 · Armenian response ready</div>
        </div>
      </section>
      <section className="api-flow content-section">
        <div className="section-heading"><span>Product interface</span><h2>{copy.chapter}</h2></div>
        <div className="flow-list">
          {copy.steps.map(([number, title, body], index) => (
            <article key={number}><b>{number}</b><div>{index === 0 ? <Radio /> : index === 1 ? <Cpu /> : <Network />}<h3>{title}</h3><p>{body}</p></div></article>
          ))}
        </div>
        <p className="api-note"><ShieldCheck />{copy.note}</p>
      </section>
    </>
  );
}

export function ArmenianSite({ kind }: { kind: ProductKind }) {
  const root = useRef<HTMLElement>(null);
  const scrollProgress = useRef(0);
  const [language, setLanguage] = useState<Language>("hy");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(LANGUAGE_KEY);
      if (stored === "en" || stored === "hy") setLanguage(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = useCallback((next: Language) => {
    setLanguage(next);
    window.localStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgress.current = height > 0 ? window.scrollY / height : 0;
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    const intro = animate(root.current?.querySelectorAll(".reveal") || [], {
      opacity: [0, 1],
      translateY: [26, 0],
      delay: stagger(85),
      duration: 780,
      ease: "outExpo",
    });
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      intro.cancel();
    };
  }, [kind]);

  const handleVoiceState = useCallback((nextListening: boolean, nextThinking: boolean) => {
    setListening(nextListening);
    setThinking(nextThinking);
  }, []);

  return (
    <main ref={root} className={`product-page page-${kind}`}>
      {kind !== "home" ? (
        <ProductScene kind={kind} progress={scrollProgress} listening={listening} thinking={thinking} />
      ) : null}
      <Header kind={kind} language={language} setLanguage={changeLanguage} />
      {kind === "home" ? <HomePage language={language} /> : null}
      {kind === "voice" ? <VoicePage language={language} onState={handleVoiceState} /> : null}
      {kind === "ai" ? <AiPage language={language} /> : null}
      {kind === "api" ? <ApiPage language={language} /> : null}
      <footer className="site-footer"><Brand /><span>{shared[language].footer}</span><span>© 2026</span></footer>
    </main>
  );
}
