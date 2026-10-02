"use client";

import { useEffect, useRef, useState } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { A11y, Keyboard, Mousewheel } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

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
  const [lessonPickerOpen, setLessonPickerOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const swiperRef = useRef<SwiperInstance | null>(null);

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
  const activeSectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) : -1;
  const activeSubsectionIndex = activeSection?.subsections.findIndex((subsection) => subsection.id === activeSubsection?.id) ?? -1;
  const nextSubsection = activeSection && activeSubsectionIndex >= 0 ? activeSection.subsections[activeSubsectionIndex + 1] : undefined;
  const nextSection = !nextSubsection && activeSectionIndex >= 0
    ? sections.slice(activeSectionIndex + 1).find((section) => section.subsections.length > 0)
    : undefined;
  const nextLesson = nextSubsection || nextSection?.subsections[0];
  const quiz = activeSubsection?.quiz;
  const answeredCount = quiz?.items.filter((item) => (answers[item.id]?.length || 0) > 0).length || 0;

  const chooseSection = (section: Section) => {
    setActiveSectionId(section.id);
    setActiveSubsectionId(section.subsections[0]?.id || "");
    setAnswers({});
    setResult(null);
    setSubmitError("");
    setLessonPickerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseSubsection = (subsection: Subsection) => {
    setActiveSubsectionId(subsection.id);
    setAnswers({});
    setResult(null);
    setSubmitError("");
    setLessonPickerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startQuiz = () => {
    setAnswers({});
    setResult(null);
    setSubmitError("");
    swiperRef.current?.slideTo(activeSubsection?.learningItems.length || 0);
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
      requestAnimationFrame(() => swiperRef.current?.slideTo((activeSubsection?.learningItems.length || 0) + quiz.items.length + 1));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your answers could not be checked.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-7 max-[760px]:px-4">
        <a className="inline-flex items-center gap-2.5 text-[15px] font-bold text-neutral-900 no-underline" href="#home" aria-label="Learn Kannada home">
          <span className="grid size-8 place-items-center bg-[#c54832] text-xl text-white" lang="kn">ಅ</span>
          <span>learn<span className="text-[#c54832]">kannada</span></span>
        </a>
        <div className="flex items-center gap-5 max-[760px]:gap-0"><span className="text-[10px] font-semibold tracking-[.1em] text-neutral-500 max-[760px]:hidden">YOUR LEARNING SPACE</span><span className="inline-flex items-center gap-2 border-l border-neutral-200 pl-5 text-xs font-medium text-neutral-700 max-[760px]:border-0 max-[760px]:pl-0">ಕನ್ನಡ <span className="text-neutral-400">·</span> Kannada</span></div>
      </header>

      <div className="mx-auto min-h-[calc(100vh-112px)] w-full max-w-[1100px] bg-white">
        <section className="min-w-0 px-8 py-8 max-[760px]:px-4 max-[760px]:py-5" id="home">
          {catalogState === "loading" && <div className="mx-auto my-[18vh] max-w-[540px] px-2"><span className="eyebrow">GETTING THINGS READY</span><h2 className="mt-3 text-xl font-medium">Opening your lessons...</h2></div>}
          {catalogState === "error" && <div className="mx-auto my-[18vh] max-w-[540px] px-2"><span className="eyebrow">CONNECTION NEEDED</span><h2 className="mt-3 text-xl font-medium">The course could not load.</h2><p className="mt-2 text-sm leading-relaxed text-neutral-600">Check that the content API is running, then refresh this page.</p></div>}
          {catalogState === "ready" && !activeSection && (
            <div className="mx-auto my-[18vh] max-w-[540px] px-2 text-center"><span className="eyebrow">YOUR COURSE IS TAKING SHAPE</span><h2 className="mt-3 text-xl font-medium">Lessons are on their way.</h2><p className="mt-2 text-sm leading-relaxed text-neutral-600">Published sections will appear here when they are ready.</p></div>
          )}
          {catalogState === "ready" && activeSection && !activeSubsection && (
            <div className="mx-auto my-[18vh] max-w-[540px] px-2 text-center"><span className="eyebrow">{activeSection.title}</span><h2 className="mt-3 text-xl font-medium">No lessons in this section yet.</h2><p className="mt-2 text-sm leading-relaxed text-neutral-600">Choose another section, or come back when new lessons are published.</p></div>
          )}

          {activeSection && activeSubsection && (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-neutral-500"><span>Course</span><span>/</span><span>{activeSection.title}</span><span>/</span><strong className="font-medium text-neutral-800">{activeSubsection.title}</strong></div>
              <div className="flex min-h-[125px] items-center border-b border-neutral-200 py-5">
                <div><span className="text-[9px] font-semibold tracking-[.1em] text-neutral-500">{activeSection.title.toUpperCase()} <span className="px-1 text-neutral-300">/</span> LESSON {String(activeSection.subsections.indexOf(activeSubsection) + 1).padStart(2, "0")}</span><h2 className="my-2 text-[28px] font-medium leading-tight text-neutral-900">{activeSubsection.title}</h2><p className="m-0 text-xs leading-relaxed text-neutral-500">{activeSubsection.description}</p></div>
              </div>

              <div className="flex items-center gap-3 py-4 text-[11px] text-neutral-500"><span>{activeSubsection.learningItems.length} learning {activeSubsection.learningItems.length === 1 ? "card" : "cards"}</span><span className="h-px w-6 bg-neutral-300" /><span className="text-[9px] font-semibold tracking-[.1em] text-neutral-600">SCROLL TO LEARN</span></div>
              {activeSubsection.learningItems.length > 0 || (quiz?.items.length || 0) > 0 ? (
                <Swiper key={activeSubsection.id} modules={[A11y, Keyboard, Mousewheel]} direction="vertical" slidesPerView={1} spaceBetween={12} keyboard={{ enabled: true, onlyInViewport: true }} mousewheel={{ forceToAxis: true, releaseOnEdges: true, sensitivity: 0.8 }} className="mx-auto h-[min(70vh,650px)] min-h-[450px] w-full max-w-[760px] overflow-hidden max-[760px]:h-[68svh] max-[760px]:min-h-[440px] max-[420px]:min-h-[420px]" role="region" aria-label="Scrollable lesson cards" onSwiper={(swiper) => { swiperRef.current = swiper; }}>
                  {activeSubsection.learningItems.map((item, index) => (
                    <SwiperSlide key={item.id}>
                      <article className="grid h-full w-full grid-cols-2 overflow-hidden border border-[var(--line)] bg-white max-[760px]:grid-cols-1 max-[760px]:grid-rows-[44%_56%] max-[420px]:grid-rows-[42%_58%]">
                        <div className={`relative grid min-w-0 place-items-center overflow-hidden text-[var(--forest)] ${item.type === "SOUND" ? "bg-[#d9e9e4]" : "bg-[#efd695]"}`}>
                          {item.image ? <img className="absolute inset-0 h-full w-full object-cover" src={item.image.url} alt={item.image.title} /> : <span className="text-[78px] leading-[1.3] max-[760px]:text-[62px]" lang="kn">{item.type === "WORD" ? item.word : item.sound}</span>}
                          <span className="absolute bottom-3 right-3 bg-[#192522d9] px-[9px] py-[7px] font-mono text-[9px] text-white">{String(index + 1).padStart(2, "0")} / {String(activeSubsection.learningItems.length).padStart(2, "0")}</span>
                        </div>
                        <div className="flex min-w-0 flex-col justify-center p-[clamp(22px,4vw,46px)] max-[760px]:p-4 max-[420px]:px-[19px]">
                          <span className="text-[9px] font-extrabold tracking-[.13em] text-[var(--vermilion)]">{item.type === "WORD" ? "WORD" : "SOUND"}</span>
                          <h3 className="my-2 mt-[18px] break-words text-[45px] font-medium leading-[1.35] text-[var(--forest)] max-[760px]:my-[3px] max-[760px]:mt-2 max-[760px]:text-[36px]" lang="kn">{item.type === "WORD" ? item.word : item.sound}</h3>
                          <p className="m-0 break-words font-serif text-[22px] leading-[1.4] text-[var(--ink)] max-[760px]:text-[18px]">{item.type === "WORD" ? item.meaning : item.description || "Listen and repeat"}</p>
                          {item.audio && <audio className="mt-[23px] h-9 w-full accent-[var(--vermilion)] max-[760px]:mt-[10px]" controls preload="none" src={item.audio.url}>{item.audio.title}</audio>}
                          <span className="mt-7 flex justify-between text-[10px] text-[#7a867f] max-[760px]:mt-[10px]">Scroll for the next card <span className="text-[var(--vermilion)]" aria-hidden="true">↓</span></span>
                        </div>
                      </article>
                    </SwiperSlide>
                  ))}

                  {quiz?.items.map((item, index) => (
                    <SwiperSlide key={item.id}>
                      <article className="grid h-full w-full grid-cols-2 items-center gap-8 overflow-y-auto border border-neutral-200 bg-neutral-50 p-8 max-[760px]:grid-cols-1 max-[760px]:gap-5 max-[760px]:p-5">
                        <div>
                          <span className="text-[9px] font-semibold tracking-[.1em] text-neutral-500">QUIZ QUESTION {String(index + 1).padStart(2, "0")} / {String(quiz.items.length).padStart(2, "0")}</span>
                          <h3 className="my-3 text-xl font-medium text-neutral-900">{item.type === "MCQ" ? "Choose all that apply" : item.type === "SOUND" ? "Listen closely" : "Choose one answer"}</h3>
                          <div className="question-content"><Media content={item.question} /></div>
                        </div>
                        <div className="option-list">
                          {item.options.map((option, optionIndex) => {
                            const selected = (answers[item.id] || []).includes(option.id);
                            return <button key={option.id} type="button" disabled={Boolean(result)} aria-pressed={selected} className={`quiz-option ${selected ? "is-selected" : ""}`} onClick={() => toggleAnswer(item, option.id)}>
                              <span className="option-key">{String.fromCharCode(65 + optionIndex)}</span><QuizOptionContent option={option} /><span className="option-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                            </button>;
                          })}
                        </div>
                        <span className="col-span-2 text-[10px] text-neutral-500 max-[760px]:col-span-1">{answeredCount} of {quiz.items.length} answered</span>
                      </article>
                    </SwiperSlide>
                  ))}

                  {quiz && quiz.items.length > 0 && <SwiperSlide key="quiz-submit"><article className="flex h-full w-full flex-col items-center justify-center gap-4 border border-neutral-200 bg-white px-8 py-10 text-center max-[760px]:px-5" aria-label="Submit quiz answers">
                    <span className="text-[9px] font-semibold tracking-[.1em] text-neutral-500">END OF QUIZ</span>
                    <h3 className="m-0 text-xl font-medium text-neutral-900">Ready to check your answers?</h3>
                    <p className="m-0 text-xs text-neutral-500">{answeredCount} of {quiz.items.length} answered · pass at {quiz.passingPercentage}%</p>
                    {submitError && <p className="m-0 text-xs text-red-700" role="alert">{submitError}</p>}
                    <button className="primary-button" disabled={submitting} onClick={checkScore}>{submitting ? "Checking..." : "Check score"}<span aria-hidden="true">↗</span></button>
                  </article></SwiperSlide>}

                  {result && quiz && <SwiperSlide key="quiz-results"><article className="h-full w-full overflow-y-auto border border-neutral-200 bg-white p-8 max-[760px]:p-5">
                    <span className="text-[9px] font-semibold tracking-[.1em] text-neutral-500">{result.passed ? "NICE WORK" : "KEEP PRACTICING"}</span>
                    <h3 className="mb-2 mt-2 text-2xl font-medium text-neutral-900">{result.passed ? "You passed." : "Not quite yet."}</h3>
                    <p className="m-0 text-sm text-neutral-600">You got <strong>{result.correctItems} of {result.totalItems}</strong> correct · score {result.percentage}% · pass mark {result.passingPercentage}%</p>
                    <div className="mt-5">
                      <h4 className="mb-1 text-sm font-semibold text-neutral-800">Answer review</h4>
                      {quiz.items.map((item, index) => {
                        const itemResult = result.itemResults.find((entry) => entry.quizItemId === item.id);
                        const selected = answers[item.id] || [];
                        const correctLabels = item.options.filter((option) => itemResult?.correctOptionIds.includes(option.id)).map((option) => option.text || option.asset?.title || "Media answer");
                        return <div className="review-row" key={item.id}><span className={`review-status ${itemResult?.correct ? "good" : "bad"}`}>{itemResult?.correct ? "✓" : "×"}</span><div><span className="review-label">QUESTION {String(index + 1).padStart(2, "0")}</span><p>{itemResult?.correct ? "Correct" : `Correct answer: ${correctLabels.join(", ") || "See the media option"}`}</p><small>{selected.length ? `${selected.length} option${selected.length === 1 ? "" : "s"} selected` : "No answer selected"}</small></div></div>;
                      })}
                    </div>
                    <button className="primary-button mt-5" onClick={startQuiz}>Try again <span aria-hidden="true">↗</span></button>
                  </article></SwiperSlide>}
                </Swiper>
              ) : <p className="border border-dashed border-neutral-300 p-5 text-sm text-neutral-500">Learning cards for this lesson have not been published yet.</p>}

              {nextLesson ? <div className="mx-auto mt-5 flex w-full max-w-[760px] items-center justify-between gap-4 border-t border-neutral-200 py-5 max-[420px]:items-start max-[420px]:flex-col">
                <div><span className="text-[9px] font-semibold tracking-[.1em] text-neutral-500">UP NEXT</span><h3 className="my-1 text-base font-medium text-neutral-900">{nextSubsection ? "Next lesson" : "Next section"}</h3><p className="m-0 text-[11px] text-neutral-500">{nextSection ? `${nextSection.title} · ${nextLesson.title}` : nextLesson.title}</p></div>
                <button className="primary-button" onClick={() => nextSubsection ? chooseSubsection(nextSubsection) : nextSection && chooseSection(nextSection)}>Continue <span aria-hidden="true">→</span></button>
              </div> : <p className="mx-auto mt-5 w-full max-w-[760px] border-t border-neutral-200 py-5 text-xs text-neutral-500">You&apos;ve reached the last lesson.</p>}

            </>
          )}
        </section>
      </div>
      {catalogState === "ready" && sections.length > 0 && <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2" onKeyDown={(event) => { if (event.key === "Escape") setLessonPickerOpen(false); }}>
        {lessonPickerOpen && <div id="lesson-picker" role="dialog" aria-label="Choose a section and lesson" className="w-[min(300px,calc(100vw-32px))] border border-neutral-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between"><strong className="text-xs font-semibold text-neutral-800">Switch lesson</strong><button className="grid size-7 place-items-center text-lg text-neutral-500 hover:bg-neutral-100" aria-label="Close lesson picker" onClick={() => setLessonPickerOpen(false)}>×</button></div>
          <label className="mb-3 grid gap-1.5 text-[10px] font-semibold text-neutral-500">SECTION
            <select className="h-10 border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 focus:outline-2 focus:outline-neutral-400" value={activeSection?.id || ""} onChange={(event) => { const section = sections.find((entry) => entry.id === event.target.value); if (section) chooseSection(section); }}>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-[10px] font-semibold text-neutral-500">LESSON
            <select className="h-10 border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 focus:outline-2 focus:outline-neutral-400" value={activeSubsection?.id || ""} disabled={!activeSection?.subsections.length} onChange={(event) => { const subsection = activeSection?.subsections.find((entry) => entry.id === event.target.value); if (subsection) chooseSubsection(subsection); }}>
              {activeSection?.subsections.map((subsection) => <option key={subsection.id} value={subsection.id}>{subsection.title}</option>)}
            </select>
          </label>
        </div>}
        <button className="grid size-11 place-items-center border border-neutral-300 bg-white text-xl text-neutral-800 shadow-md hover:bg-neutral-50" type="button" aria-label="Switch section or lesson" aria-expanded={lessonPickerOpen} aria-controls="lesson-picker" title="Switch section or lesson" onClick={() => setLessonPickerOpen((open) => !open)}><span aria-hidden="true">☰</span></button>
      </div>}
      <footer className="mx-auto flex min-h-12 w-full max-w-[1400px] items-center justify-between border-t border-neutral-200 px-6 text-[10px] text-neutral-500"><span className="font-semibold tracking-[.1em]">LEARN KANNADA</span><span className="text-neutral-600" lang="kn">ಕನ್ನಡ ಕಲಿಯಿರಿ</span></footer>
    </main>
  );
}