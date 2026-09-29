"use client";

import { useEffect, useState } from "react";

type Asset = { id: string; title: string; type: "IMAGE" | "AUDIO" | "VIDEO"; url: string };
type Content = { type: "TEXT" | "IMAGE" | "AUDIO"; text?: string; asset?: Asset | null };
type LearningItem = {
  id: string;
  type: "WORD" | "SOUND";
  sequence: number;
  word?: string;
  meaning?: string;
  sound?: string;
  description?: string | null;
  image?: Asset | null;
  audio?: Asset | null;
};
type QuizOption = { id: string; type: "TEXT" | "IMAGE" | "AUDIO"; text?: string | null; asset?: Asset | null };
type QuizItem = {
  id: string;
  type: "SCQ" | "MCQ" | "SOUND";
  question: Content;
  options: QuizOption[];
};
type Quiz = { id: string; passingPercentage: number; items: QuizItem[] };
type Subsection = {
  id: string;
  title: string;
  description: string;
  image?: Asset | null;
  learningItems: LearningItem[];
  quiz: Quiz | null;
};
type Section = {
  id: string;
  title: string;
  description: string;
  image?: Asset | null;
  subsections: Subsection[];
};
type QuizResult = {
  totalItems: number;
  correctItems: number;
  percentage: number;
  passingPercentage: number;
  passed: boolean;
  itemResults: { quizItemId: string; correct: boolean; correctOptionIds: string[] }[];
};

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "https://dev.learnkannada.co.in/api").replace(/\/$/, "");

function Media({ content, className = "" }: { content: Content; className?: string }) {
  if (content.type === "TEXT") return <span className={className}>{content.text}</span>;
  if (!content.asset) return <span className="media-missing">Media unavailable</span>;
  if (content.type === "AUDIO") {
    return <audio className={className} controls preload="none" src={content.asset.url}>{content.asset.title}</audio>;
  }
  return (
    <span className={`media-image-wrap ${className}`}>
      <img src={content.asset.url} alt={content.asset.title} />
    </span>
  );
}

function QuizOptionContent({ option }: { option: QuizOption }) {
  if (option.type === "TEXT") return <span>{option.text}</span>;
  if (!option.asset) return <span className="media-missing">Media unavailable</span>;
  if (option.type === "AUDIO") {
    return <audio controls preload="none" src={option.asset.url}>{option.asset.title}</audio>;
  }
  return <span className="option-image"><img src={option.asset.url} alt={option.asset.title} /></span>;
}

export default function Home() {
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [activeSubsectionId, setActiveSubsectionId] = useState("");
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<"lesson" | "quiz" | "result">("lesson");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiUrl}/catalog/sections`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The lesson catalog could not be loaded.");
        return response.json() as Promise<{ sections: Section[] }>;
      })
      .then((data) => {
        setSections(data.sections);
        setActiveSectionId(data.sections[0]?.id || "");
        setActiveSubsectionId(data.sections[0]?.subsections[0]?.id || "");
        setCatalogState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogState("error");
      });
    return () => controller.abort();
  }, []);

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const activeSubsection = activeSection?.subsections.find((subsection) => subsection.id === activeSubsectionId)
    || activeSection?.subsections[0];
  const quiz = activeSubsection?.quiz;
  const answeredCount = quiz?.items.filter((item) => (answers[item.id]?.length || 0) > 0).length || 0;

  const chooseSection = (section: Section) => {
    setActiveSectionId(section.id);
    setActiveSubsectionId(section.subsections[0]?.id || "");
    setView("lesson");
  };

  const chooseSubsection = (subsection: Subsection) => {
    setActiveSubsectionId(subsection.id);
    setView("lesson");
  };

  const startQuiz = () => {
    setAnswers({});
    setResult(null);
    setSubmitError("");
    setView("quiz");
  };

  const toggleAnswer = (item: QuizItem, optionId: string) => {
    setAnswers((current) => {
      const selected = current[item.id] || [];
      const next = item.type === "MCQ"
        ? selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId]
        : [optionId];
      return { ...current, [item.id]: next };
    });
  };

  const checkScore = async () => {
    if (!quiz) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(`${apiUrl}/quizzes/${quiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([quizItemId, selectedOptionIds]) => ({ quizItemId, selectedOptionIds })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Your answers could not be checked.");
      setResult(body.result as QuizResult);
      setView("result");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your answers could not be checked.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="learning-app">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Learn Kannada home">
          <span className="brand-mark" lang="kn">ಅ</span>
          <span>learn<span className="brand-accent">kannada</span></span>
        </a>
        <div className="topbar-right"><span className="catalog-label">YOUR LEARNING SPACE</span><span className="language-chip">ಕನ್ನಡ <span>·</span> Kannada</span></div>
      </header>

      <div className="app-shell">
        <aside className="course-rail" aria-label="Course navigation">
          <div className="rail-heading"><span className="eyebrow">COURSE</span><span className="course-count">{String(sections.length).padStart(2, "0")}</span></div>
          <h1 className="rail-title">Kannada<br />foundations</h1>
          <p className="rail-copy">Small steps into a whole new language.</p>

          {catalogState === "loading" && <p className="rail-state">Loading course...</p>}
          {catalogState === "error" && <p className="rail-state rail-error">Can&apos;t reach the course catalog.</p>}
          {sections.map((section, index) => (
            <div className="section-nav-group" key={section.id}>
              <button className={`section-nav ${section.id === activeSection?.id ? "is-active" : ""}`} onClick={() => chooseSection(section)}>
                <span className="section-number">{String(index + 1).padStart(2, "0")}</span><span>{section.title}</span>
              </button>
              {section.id === activeSection?.id && section.subsections.length > 0 && (
                <div className="subsection-nav">
                  {section.subsections.map((subsection, subIndex) => (
                    <button key={subsection.id} className={subsection.id === activeSubsection?.id ? "is-active" : ""} onClick={() => chooseSubsection(subsection)}>
                      <span>{String(subIndex + 1).padStart(2, "0")}</span>{subsection.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="rail-note"><span className="rail-note-mark" lang="kn">ನಮಸ್ಕಾರ</span><p>A little practice, a little every day.</p></div>
        </aside>

        <section className="workspace" id="home">
          {catalogState === "loading" && <div className="empty-state"><span className="eyebrow">GETTING THINGS READY</span><h2>Opening your lessons...</h2></div>}
          {catalogState === "error" && <div className="empty-state"><span className="eyebrow">CONNECTION NEEDED</span><h2>The course could not load.</h2><p>Check that the content API is running, then refresh this page.</p></div>}
          {catalogState === "ready" && !activeSection && (
            <div className="empty-state empty-catalog"><span className="empty-glyph" lang="kn">ಅ</span><span className="eyebrow">YOUR COURSE IS TAKING SHAPE</span><h2>Lessons are on their way.</h2><p>Published sections will appear here when they are ready.</p></div>
          )}
          {catalogState === "ready" && activeSection && !activeSubsection && (
            <div className="empty-state empty-catalog"><span className="eyebrow">{activeSection.title}</span><h2>No lessons in this section yet.</h2><p>Choose another section, or come back when new lessons are published.</p></div>
          )}

          {activeSection && activeSubsection && view === "lesson" && (
            <>
              <div className="breadcrumb"><span>Course</span><span>/</span><span>{activeSection.title}</span><span>/</span><strong>{activeSubsection.title}</strong></div>
              <div className="lesson-heading">
                <div><span className="eyebrow">{activeSection.title.toUpperCase()} <span className="eyebrow-dot">/</span> LESSON {String(activeSection.subsections.indexOf(activeSubsection) + 1).padStart(2, "0")}</span><h2>{activeSubsection.title}</h2><p>{activeSubsection.description}</p></div>
                <div className="lesson-stamp" lang="kn" aria-hidden="true">{activeSubsection.image ? <img src={activeSubsection.image.url} alt="" /> : "ಮ"}</div>
              </div>

              <div className="content-toolbar"><span>{activeSubsection.learningItems.length} learning {activeSubsection.learningItems.length === 1 ? "card" : "cards"}</span><span className="toolbar-line" /><span>WORDS &amp; SOUNDS</span></div>
              {activeSubsection.learningItems.length > 0 ? (
                <div className="lesson-grid">
                  {activeSubsection.learningItems.map((item, index) => (
                    <article className={`learning-card ${item.type === "SOUND" ? "sound-card" : "word-card"}`} key={item.id}>
                      <div className="card-topline"><span>{item.type === "WORD" ? "WORD" : "SOUND"}</span><span>{String(index + 1).padStart(2, "0")}</span></div>
                      {item.image && <img className="learning-image" src={item.image.url} alt={item.image.title} />}
                      <p className="kannada-word" lang="kn">{item.type === "WORD" ? item.word : item.sound}</p>
                      <h3>{item.type === "WORD" ? item.meaning : item.description || "Listen and repeat"}</h3>
                      {item.type === "WORD" && item.word && <p className="romanization">{item.word}</p>}
                      {item.audio && <audio className="lesson-audio" controls preload="none" src={item.audio.url}>{item.audio.title}</audio>}
                    </article>
                  ))}
                </div>
              ) : <p className="inline-empty">Learning cards for this lesson have not been published yet.</p>}

              <div className="practice-banner">
                <div><span className="eyebrow">READY WHEN YOU ARE</span><h3>Put it into practice.</h3><p>{quiz ? `${quiz.items.length} questions · pass at ${quiz.passingPercentage}%` : "The quiz for this lesson is not published yet."}</p></div>
                <button className="primary-button" disabled={!quiz || quiz.items.length === 0} onClick={startQuiz}>Start the quiz <span aria-hidden="true">↗</span></button>
              </div>
            </>
          )}

          {activeSection && activeSubsection && view === "quiz" && quiz && (
            <div className="quiz-view">
              <div className="quiz-topline"><button className="text-button" onClick={() => setView("lesson")}>← Back to lesson</button><span>{answeredCount} of {quiz.items.length} answered</span></div>
              <div className="quiz-heading"><span className="eyebrow">QUICK CHECK <span className="eyebrow-dot">/</span> PASSING {quiz.passingPercentage}%</span><h2>Show what you know.</h2><p>{activeSubsection.title}</p></div>
              <div className="quiz-list">
                {quiz.items.map((item, index) => (
                  <section className="quiz-question" key={item.id}>
                    <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className="question-body"><div className="question-kind">{item.type === "MCQ" ? "CHOOSE ALL THAT APPLY" : item.type === "SOUND" ? "LISTEN CLOSELY" : "CHOOSE ONE"}</div>
                      <div className="question-content"><Media content={item.question} /></div>
                      <div className="option-list">
                        {item.options.map((option, optionIndex) => {
                          const selected = (answers[item.id] || []).includes(option.id);
                          return <button key={option.id} aria-pressed={selected} className={`quiz-option ${selected ? "is-selected" : ""}`} onClick={() => toggleAnswer(item, option.id)}>
                            <span className="option-key">{String.fromCharCode(65 + optionIndex)}</span><QuizOptionContent option={option} /><span className="option-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                          </button>;
                        })}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
              {submitError && <p className="submit-error" role="alert">{submitError}</p>}
              <div className="quiz-submit"><span>Unanswered questions count as incorrect.</span><button className="primary-button" disabled={submitting || quiz.items.length === 0} onClick={checkScore}>{submitting ? "Checking..." : "Check score"} <span aria-hidden="true">↗</span></button></div>
            </div>
          )}

          {activeSection && activeSubsection && view === "result" && result && quiz && (
            <div className="result-view">
              <button className="text-button" onClick={() => setView("lesson")}>← Back to lesson</button>
              <div className={`result-mark ${result.passed ? "passed" : "not-passed"}`} aria-hidden="true">{result.passed ? "✓" : "↻"}</div>
              <span className="eyebrow">{result.passed ? "NICE WORK" : "KEEP PRACTICING"}</span>
              <h2>{result.passed ? "You passed." : "Not quite yet."}</h2>
              <p className="result-summary">You got <strong>{result.correctItems} of {result.totalItems}</strong> correct.</p>
              <div className="score-line"><div><span>Your score</span><strong>{result.percentage}%</strong></div><span>Pass mark&nbsp; {result.passingPercentage}%</span></div>
              <div className="result-review"><h3>Answer review</h3>{quiz.items.map((item, index) => {
                const itemResult = result.itemResults.find((entry) => entry.quizItemId === item.id);
                const selected = answers[item.id] || [];
                const correctLabels = item.options.filter((option) => itemResult?.correctOptionIds.includes(option.id)).map((option) => option.text || option.asset?.title || "Media answer");
                return <div className="review-row" key={item.id}><span className={itemResult?.correct ? "review-status good" : "review-status bad"}>{itemResult?.correct ? "✓" : "×"}</span><div><span className="review-label">QUESTION {String(index + 1).padStart(2, "0")}</span><p>{itemResult?.correct ? "Correct" : `Correct answer: ${correctLabels.join(", ") || "See the media option"}`}</p><small>{selected.length ? `${selected.length} option${selected.length === 1 ? "" : "s"} selected` : "No answer selected"}</small></div></div>;
              })}</div>
              <button className="primary-button result-retry" onClick={startQuiz}>Try again <span aria-hidden="true">↗</span></button>
            </div>
          )}
        </section>
      </div>
      <footer className="app-footer"><span>LEARN KANNADA</span><span>A good word is a beginning.</span><span lang="kn">ಕನ್ನಡ ಕಲಿಯಿರಿ</span></footer>
    </main>
  );
}