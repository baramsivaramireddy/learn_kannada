"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type Visibility = "DRAFT" | "PUBLIC";
type AssetType = "IMAGE" | "AUDIO" | "VIDEO";
type ContentType = "TEXT" | "IMAGE" | "AUDIO";
type Asset = { id: string; title: string; type: AssetType; url: string; visibility: Visibility; location: string };
type Option = { id: string; sequence: number; type: ContentType; text: string | null; assetId: string | null; isCorrect: boolean; asset: Asset | null };
type QuizItem = { id: string; type: "SCQ" | "MCQ" | "SOUND"; sequence: number; questionType: ContentType; questionText: string | null; questionAsset: Asset | null; visibility: Visibility; options: Option[] };
type LearningItem = { id: string; type: "WORD" | "SOUND"; sequence: number; word: string | null; meaning: string | null; sound: string | null; description: string | null; visibility: Visibility };
type Quiz = { id: string; passingPercentage: number; visibility: Visibility; items: QuizItem[] };
type Subsection = { id: string; title: string; description: string; sequence: number; visibility: Visibility; learningItems: LearningItem[]; quiz: Quiz | null };
type Section = { id: string; title: string; description: string; sequence: number; visibility: Visibility; subsections: Subsection[] };
type Catalog = { sections: Section[]; assets: Asset[] };
type OptionDraft = { id: string; type: ContentType; text: string; assetId: string; isCorrect: boolean };

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

async function apiRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body as T;
}

function emptyOption(index: number): OptionDraft {
  return { id: `option-${Date.now()}-${index}`, type: "TEXT", text: "", assetId: "", isCorrect: index === 0 };
}

export default function AdminPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<Catalog>({ sections: [], assets: [] });
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubsectionId, setSelectedSubsectionId] = useState("");
  const [activePanel, setActivePanel] = useState<"content" | "assets">("content");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [sectionSequence, setSectionSequence] = useState("1");
  const [subsectionTitle, setSubsectionTitle] = useState("");
  const [subsectionDescription, setSubsectionDescription] = useState("");
  const [subsectionSequence, setSubsectionSequence] = useState("1");
  const [passingPercentage, setPassingPercentage] = useState("70");

  const [learningType, setLearningType] = useState<"WORD" | "SOUND">("WORD");
  const [learningSequence, setLearningSequence] = useState("1");
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [sound, setSound] = useState("");
  const [learningDescription, setLearningDescription] = useState("");
  const [learningImageId, setLearningImageId] = useState("");
  const [learningAudioId, setLearningAudioId] = useState("");

  const [quizType, setQuizType] = useState<"SCQ" | "MCQ" | "SOUND">("SCQ");
  const [quizSequence, setQuizSequence] = useState("1");
  const [questionType, setQuestionType] = useState<ContentType>("TEXT");
  const [questionText, setQuestionText] = useState("");
  const [questionAssetId, setQuestionAssetId] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([emptyOption(0), emptyOption(1), emptyOption(2), emptyOption(3)]);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");

  const selectedSection = catalog.sections.find((section) => section.id === selectedSectionId) || catalog.sections[0];
  const selectedSubsection = selectedSection?.subsections.find((subsection) => subsection.id === selectedSubsectionId)
    || selectedSection?.subsections[0];

  const loadCatalog = async (authToken: string) => {
    const data = await apiRequest<Catalog>("/admin/catalog", authToken);
    setCatalog(data);
    setSelectedSectionId((current) => data.sections.some((section) => section.id === current) ? current : data.sections[0]?.id || "");
    setSelectedSubsectionId((current) => data.sections.some((section) => section.subsections.some((subsection) => subsection.id === current))
      ? current
      : data.sections[0]?.subsections[0]?.id || "");
  };

  const unlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await loadCatalog(tokenInput.trim());
      setToken(tokenInput.trim());
      setTokenInput("");
      setNotice("Content studio unlocked.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not verify the token.");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const createSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction(async () => {
      const response = await apiRequest<{ section: Section }>("/admin/sections", token, {
        method: "POST",
        body: JSON.stringify({ title: sectionTitle, description: sectionDescription, sequence: Number(sectionSequence), visibility: "DRAFT" }),
      });
      await loadCatalog(token);
      setSelectedSectionId(response.section.id);
      setSelectedSubsectionId("");
      setSectionTitle("");
      setSectionDescription("");
      setSectionSequence(String(catalog.sections.length + 2));
    }, "Draft section created.");
  };

  const createSubsection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSection) return;
    void runAction(async () => {
      const response = await apiRequest<{ subsection: Subsection }>("/admin/subsections", token, {
        method: "POST",
        body: JSON.stringify({
          sectionId: selectedSection.id,
          title: subsectionTitle,
          description: subsectionDescription,
          sequence: Number(subsectionSequence),
          passingPercentage: Number(passingPercentage),
          visibility: "DRAFT",
        }),
      });
      await loadCatalog(token);
      setSelectedSubsectionId(response.subsection.id);
      setSubsectionTitle("");
      setSubsectionDescription("");
      setSubsectionSequence(String(selectedSection.subsections.length + 2));
    }, "Draft lesson and its quiz created.");
  };

  const createLearningItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSubsection) return;
    void runAction(async () => {
      const payload = learningType === "WORD"
        ? { subsectionId: selectedSubsection.id, type: learningType, sequence: Number(learningSequence), word, meaning, imageAssetId: learningImageId || null, audioAssetId: learningAudioId || null }
        : { subsectionId: selectedSubsection.id, type: learningType, sequence: Number(learningSequence), sound, description: learningDescription || null, audioAssetId: learningAudioId || null };
      await apiRequest("/admin/learning-items", token, { method: "POST", body: JSON.stringify(payload) });
      await loadCatalog(token);
      setWord("");
      setMeaning("");
      setSound("");
      setLearningDescription("");
      setLearningSequence(String(selectedSubsection.learningItems.length + 2));
    }, "Draft learning item created.");
  };

  const updateOption = (index: number, update: Partial<OptionDraft>) => {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...update } : option));
  };

  const markCorrect = (index: number, checked: boolean) => {
    setOptions((current) => current.map((option, optionIndex) => ({
      ...option,
      isCorrect: quizType === "MCQ" ? optionIndex === index ? checked : option.isCorrect : optionIndex === index && checked,
    })));
  };

  const createQuizItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentQuiz = selectedSubsection?.quiz;
    if (!selectedSubsection || !currentQuiz) return;
    void runAction(async () => {
      const resolvedQuestionType = quizType === "SOUND" ? "AUDIO" : questionType;
      const question = resolvedQuestionType === "TEXT"
        ? { type: resolvedQuestionType, text: questionText }
        : { type: resolvedQuestionType, assetId: questionAssetId };
      const optionPayload = options.map((option, index) => ({
        id: option.id,
        sequence: index + 1,
        type: option.type,
        ...(option.type === "TEXT" ? { text: option.text } : { assetId: option.assetId }),
        isCorrect: option.isCorrect,
      }));
      await apiRequest("/admin/quiz-items", token, {
        method: "POST",
        body: JSON.stringify({
          quizId: currentQuiz.id,
          type: quizType,
          sequence: Number(quizSequence),
          question,
          options: optionPayload,
        }),
      });
      await loadCatalog(token);
      setQuestionText("");
      setQuestionAssetId("");
      setQuizSequence(String(currentQuiz.items.length + 2));
      setOptions([emptyOption(0), emptyOption(1), emptyOption(2), emptyOption(3)]);
    }, "Draft quiz question created.");
  };

  const setVisibility = (resource: string, id: string, visibility: Visibility) => {
    void runAction(async () => {
      await apiRequest(`/admin/${resource}/${id}/visibility`, token, {
        method: "PATCH",
        body: JSON.stringify({ visibility }),
      });
      await loadCatalog(token);
    }, visibility === "PUBLIC" ? "Content published to learners." : "Content moved back to draft.");
  };

  const uploadAsset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadFile) return;
    void runAction(async () => {
      const signed = await apiRequest<{ asset: Asset; uploadUrl: string; requiredHeaders: Record<string, string> }>("/admin/assets/upload-url", token, {
        method: "POST",
        body: JSON.stringify({
          fileName: uploadFile.name,
          contentType: uploadFile.type,
          title: uploadTitle || uploadFile.name,
          description: uploadDescription || undefined,
        }),
      });
      const response = await fetch(signed.uploadUrl, { method: "PUT", headers: signed.requiredHeaders, body: uploadFile });
      if (!response.ok) throw new Error("The asset record was created, but the file upload failed. Retry with a new upload.");
      await loadCatalog(token);
      setUploadFile(null);
      setUploadTitle("");
      setUploadDescription("");
    }, "Asset uploaded as a draft. Publish it before attaching it to public content.");
  };

  const logout = () => {
    setToken("");
    setCatalog({ sections: [], assets: [] });
    setSelectedSectionId("");
    setSelectedSubsectionId("");
    setNotice("");
    setError("");
  };

  const assetSelect = (label: string, type: AssetType, value: string, onChange: (value: string) => void) => (
    <label className="admin-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">No asset</option>
        {catalog.assets.filter((asset) => asset.type === type).map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.visibility}</option>)}
      </select>
    </label>
  );

  const publishButton = (resource: string, id: string, visibility: Visibility) => (
    <button className={`visibility-button ${visibility === "PUBLIC" ? "is-public" : ""}`} disabled={busy} onClick={() => setVisibility(resource, id, visibility === "PUBLIC" ? "DRAFT" : "PUBLIC")}>
      <span className="visibility-dot" />{visibility === "PUBLIC" ? "Published" : "Publish"}
    </button>
  );

  if (!token) {
    return (
      <main className="admin-gate">
        <div className="admin-gate-aside"><Link className="brand" href="/" aria-label="Learn Kannada home"><span className="brand-mark" lang="kn">ಅ</span><span>learn<span className="brand-accent">kannada</span></span></Link><div className="gate-script" lang="kn">ಅಕ್ಷರ<br />ಅರ್ಥ<br />ಅಭ್ಯಾಸ</div><p>Words begin here.</p></div>
        <section className="admin-gate-content">
          <span className="admin-kicker">CONTENT STUDIO <span>·</span> PRIVATE</span>
          <h1>Make room<br />for a new word.</h1>
          <p className="gate-description">Sign in with your content admin token to create and publish Kannada lessons.</p>
          <form className="admin-form gate-form" onSubmit={unlock}>
            <label className="admin-field"><span>CONTENT ADMIN TOKEN</span><input type="password" autoComplete="current-password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="Paste your token" required /></label>
            {error && <p className="admin-message is-error" role="alert">{error}</p>}
            <button className="admin-primary" type="submit" disabled={busy}>{busy ? "Checking token..." : "Open content studio"}<span aria-hidden="true">↗</span></button>
          </form>
          <Link className="gate-home-link" href="/">← Return to learner view</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-app">
      <header className="admin-topbar">
        <Link className="brand" href="/" aria-label="Learn Kannada home"><span className="brand-mark" lang="kn">ಅ</span><span>learn<span className="brand-accent">kannada</span></span></Link>
        <div className="admin-topbar-actions"><span className="admin-mode"><span /> CONTENT STUDIO</span><Link className="learner-link" href="/">Learner view ↗</Link><button className="logout-button" onClick={logout} title="Lock content studio" aria-label="Lock content studio">⌑</button></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-title"><div><span className="admin-kicker">WORKSPACE</span><h1>Content</h1></div><span className="admin-count">{String(catalog.sections.length).padStart(2, "0")}</span></div>
          <div className="admin-tabs" role="tablist" aria-label="Admin workspace">
            <button role="tab" aria-selected={activePanel === "content"} className={activePanel === "content" ? "active" : ""} onClick={() => setActivePanel("content")}>Lessons</button>
            <button role="tab" aria-selected={activePanel === "assets"} className={activePanel === "assets" ? "active" : ""} onClick={() => setActivePanel("assets")}>Assets <span>{catalog.assets.length}</span></button>
          </div>
          {activePanel === "content" && <>
            <div className="admin-nav-label">SECTIONS</div>
            <div className="admin-section-list">
              {catalog.sections.map((section, index) => (
                <div className="admin-section-entry" key={section.id}>
                  <div className="admin-section-header">
                    <button className={`admin-section-button ${section.id === selectedSection?.id ? "selected" : ""}`} onClick={() => { setSelectedSectionId(section.id); setSelectedSubsectionId(section.subsections[0]?.id || ""); }}>
                      <span>{String(index + 1).padStart(2, "0")}</span><strong>{section.title}</strong><i className={section.visibility === "PUBLIC" ? "public" : "draft"} />
                    </button>
                    {publishButton("sections", section.id, section.visibility)}
                  </div>
                  {section.id === selectedSection?.id && section.subsections.map((subsection) => (
                    <button key={subsection.id} className={`admin-subsection-button ${subsection.id === selectedSubsection?.id ? "selected" : ""}`} onClick={() => setSelectedSubsectionId(subsection.id)}><span />{subsection.title}</button>
                  ))}
                </div>
              ))}
              {catalog.sections.length === 0 && <p className="admin-sidebar-empty">No sections yet. Add your first section below.</p>}
            </div>
          </>}
          <div className="admin-sidebar-bottom"><span className="secure-mark">⌑</span><span>Token held in memory<br />for this page session.</span></div>
        </aside>

        <section className="admin-workspace">
          <div className="admin-workspace-head"><div><span className="admin-kicker">{activePanel === "content" ? "LESSON BUILDER" : "MEDIA LIBRARY"} <span>·</span> {catalog.sections.length} SECTIONS</span><h2>{activePanel === "content" ? "Build a learning path." : "Reusable assets."}</h2><p>{activePanel === "content" ? "Draft the structure, add learning material, then publish when it is ready." : "Upload once, reference audio and images anywhere in your content."}</p></div><div className="admin-glyph" lang="kn">ಕ</div></div>
          {error && <div className="admin-message is-error" role="alert">{error}</div>}
          {notice && <div className="admin-message is-success" role="status">{notice}</div>}

          {activePanel === "content" ? <div className="admin-content-grid">
            <section className="admin-panel create-panel">
              <div className="panel-heading"><div><span className="admin-kicker">01 / COURSE STRUCTURE</span><h3>Add a section</h3></div><span className="panel-index">01</span></div>
              <form className="admin-form" onSubmit={createSection}>
                <label className="admin-field"><span>SECTION TITLE</span><input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="e.g. First words" required /></label>
                <label className="admin-field"><span>DESCRIPTION</span><textarea value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} rows={2} placeholder="What will learners discover?" /></label>
                <label className="admin-field"><span>ORDER</span><input type="number" step="0.1" value={sectionSequence} onChange={(event) => setSectionSequence(event.target.value)} required /></label>
                <button className="admin-primary" type="submit" disabled={busy}>Create draft section <span aria-hidden="true">+</span></button>
              </form>
            </section>

            <section className="admin-panel create-panel">
              <div className="panel-heading"><div><span className="admin-kicker">02 / LESSON STRUCTURE</span><h3>Add a subsection</h3></div><span className="panel-index">02</span></div>
              {selectedSection ? <form className="admin-form" onSubmit={createSubsection}>
                <div className="selected-parent"><span>IN SECTION</span><strong>{selectedSection.title}</strong></div>
                <label className="admin-field"><span>LESSON TITLE</span><input value={subsectionTitle} onChange={(event) => setSubsectionTitle(event.target.value)} placeholder="e.g. At home" required /></label>
                <label className="admin-field"><span>DESCRIPTION</span><textarea value={subsectionDescription} onChange={(event) => setSubsectionDescription(event.target.value)} rows={2} placeholder="A short learning objective" /></label>
                <div className="admin-form-row"><label className="admin-field"><span>ORDER</span><input type="number" step="0.1" value={subsectionSequence} onChange={(event) => setSubsectionSequence(event.target.value)} required /></label><label className="admin-field"><span>PASS MARK %</span><input type="number" min="0" max="100" value={passingPercentage} onChange={(event) => setPassingPercentage(event.target.value)} required /></label></div>
                <button className="admin-primary" type="submit" disabled={busy}>Create lesson + quiz <span aria-hidden="true">+</span></button>
                <small className="form-footnote">A draft quiz is created with every subsection.</small>
              </form> : <p className="admin-sidebar-empty">Create or select a section to add a lesson.</p>}
            </section>

            <section className="admin-panel detail-panel">
              <div className="panel-heading"><div><span className="admin-kicker">03 / SELECTED LESSON</span><h3>{selectedSubsection?.title || "Choose a subsection"}</h3></div>{selectedSubsection && publishButton("subsections", selectedSubsection.id, selectedSubsection.visibility)}</div>
              {selectedSubsection ? <>
                <div className="detail-meta"><span>{selectedSection?.title}</span><span>{selectedSubsection.learningItems.length} learning items</span><span>{selectedSubsection.quiz?.items.length || 0} quiz questions</span></div>
                <div className="existing-items">
                  {selectedSubsection.learningItems.map((item) => <div className="existing-row" key={item.id}><span className="type-tag">{item.type}</span><strong lang="kn">{item.type === "WORD" ? item.word : item.sound}</strong><span>{item.type === "WORD" ? item.meaning : item.description}</span>{publishButton("learning-items", item.id, item.visibility)}</div>)}
                  {selectedSubsection.quiz?.items.map((item) => <div className="existing-row" key={item.id}><span className="type-tag quiz-tag">{item.type}</span><strong>Question {item.sequence}</strong><span>{item.questionText || item.questionAsset?.title || item.options.length + " options"}</span>{publishButton("quiz-items", item.id, item.visibility)}</div>)}
                  {!selectedSubsection.learningItems.length && !selectedSubsection.quiz?.items.length && <p className="admin-sidebar-empty">This lesson is empty. Add its learning material and quiz questions below.</p>}
                </div>
                {selectedSubsection.quiz && <div className="quiz-publish-row"><span><strong>Lesson quiz</strong><small>Passing score {selectedSubsection.quiz.passingPercentage}% · {selectedSubsection.quiz.items.length} questions</small></span>{publishButton("quizzes", selectedSubsection.quiz.id, selectedSubsection.quiz.visibility)}</div>}
              </> : <p className="admin-sidebar-empty">Select a lesson in the left navigation to manage its content.</p>}
            </section>

            {selectedSubsection && <>
              <section className="admin-panel create-panel">
                <div className="panel-heading"><div><span className="admin-kicker">04 / LEARNING MATERIAL</span><h3>Add a learning item</h3></div><span className="panel-index">04</span></div>
                <form className="admin-form" onSubmit={createLearningItem}>
                  <div className="admin-form-row"><label className="admin-field"><span>ITEM TYPE</span><select value={learningType} onChange={(event) => setLearningType(event.target.value as "WORD" | "SOUND")}><option value="WORD">Word</option><option value="SOUND">Sound</option></select></label><label className="admin-field"><span>ORDER</span><input type="number" step="0.1" value={learningSequence} onChange={(event) => setLearningSequence(event.target.value)} required /></label></div>
                  {learningType === "WORD" ? <><label className="admin-field"><span>KANNADA WORD</span><input value={word} onChange={(event) => setWord(event.target.value)} lang="kn" placeholder="ಮನೆ" required /></label><label className="admin-field"><span>MEANING</span><input value={meaning} onChange={(event) => setMeaning(event.target.value)} placeholder="House" required /></label>{assetSelect("IMAGE ASSET", "IMAGE", learningImageId, setLearningImageId)}</> : <><label className="admin-field"><span>SOUND</span><input value={sound} onChange={(event) => setSound(event.target.value)} lang="kn" placeholder="ಅ" required /></label><label className="admin-field"><span>DESCRIPTION</span><input value={learningDescription} onChange={(event) => setLearningDescription(event.target.value)} placeholder="Kannada vowel sound" /></label></>}
                  {assetSelect("AUDIO ASSET", "AUDIO", learningAudioId, setLearningAudioId)}
                  <button className="admin-primary" type="submit" disabled={busy}>Add draft item <span aria-hidden="true">+</span></button>
                </form>
              </section>

              <section className="admin-panel create-panel quiz-create-panel">
                <div className="panel-heading"><div><span className="admin-kicker">05 / ASSESSMENT</span><h3>Add a quiz question</h3></div><span className="panel-index">05</span></div>
                {selectedSubsection.quiz ? <form className="admin-form" onSubmit={createQuizItem}>
                  <div className="admin-form-row"><label className="admin-field"><span>QUESTION TYPE</span><select value={quizType} onChange={(event) => { const nextType = event.target.value as "SCQ" | "MCQ" | "SOUND"; setQuizType(nextType); if (nextType === "SOUND") setQuestionType("AUDIO"); }}><option value="SCQ">Single choice</option><option value="MCQ">Multiple choice</option><option value="SOUND">Sound question</option></select></label><label className="admin-field"><span>ORDER</span><input type="number" step="0.1" value={quizSequence} onChange={(event) => setQuizSequence(event.target.value)} required /></label></div>
                  {quizType !== "SOUND" && <label className="admin-field"><span>QUESTION CONTENT</span><select value={questionType} onChange={(event) => setQuestionType(event.target.value as ContentType)}><option value="TEXT">Text</option><option value="IMAGE">Image</option><option value="AUDIO">Audio</option></select></label>}
                  {(quizType === "SOUND" ? "AUDIO" : questionType) === "TEXT" ? <label className="admin-field"><span>QUESTION</span><textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={2} placeholder="What does ಮನೆ mean?" required /></label> : assetSelect("QUESTION ASSET", quizType === "SOUND" || questionType === "AUDIO" ? "AUDIO" : "IMAGE", questionAssetId, setQuestionAssetId)}
                  <div className="options-heading"><span>ANSWER OPTIONS</span><span>{quizType === "MCQ" ? "MARK ALL CORRECT" : "MARK THE CORRECT ANSWER"}</span></div>
                  {options.map((option, index) => <div className="option-editor" key={option.id}>
                    <span className="option-editor-letter">{String.fromCharCode(65 + index)}</span>
                    <select aria-label={`Option ${index + 1} content type`} value={option.type} onChange={(event) => updateOption(index, { type: event.target.value as ContentType })}><option value="TEXT">Text</option><option value="IMAGE">Image</option><option value="AUDIO">Audio</option></select>
                    {option.type === "TEXT" ? <input aria-label={`Option ${index + 1} text`} value={option.text} onChange={(event) => updateOption(index, { text: event.target.value })} placeholder={`Option ${String.fromCharCode(65 + index)}`} required /> : <select aria-label={`Option ${index + 1} asset`} value={option.assetId} onChange={(event) => updateOption(index, { assetId: event.target.value })} required><option value="">Choose asset</option>{catalog.assets.filter((asset) => asset.type === (option.type === "IMAGE" ? "IMAGE" : "AUDIO")).map((asset) => <option value={asset.id} key={asset.id}>{asset.title} · {asset.visibility}</option>)}</select>}
                    <label className="correct-toggle" title="Mark correct"><input type={quizType === "MCQ" ? "checkbox" : "radio"} name="correct-option" checked={option.isCorrect} onChange={(event) => markCorrect(index, event.target.checked)} aria-label={`Option ${index + 1} is correct`} /><span>✓</span></label>
                    <button className="remove-option" type="button" title="Remove option" aria-label={`Remove option ${index + 1}`} disabled={options.length <= 2} onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}>×</button>
                  </div>)}
                  <button className="add-option" type="button" onClick={() => setOptions((current) => [...current, emptyOption(current.length)])}>+ Add option</button>
                  <button className="admin-primary" type="submit" disabled={busy}>Add draft question <span aria-hidden="true">+</span></button>
                </form> : <p className="admin-sidebar-empty">A quiz is created automatically with this subsection.</p>}
              </section>
            </>}
          </div> : <div className="asset-library">
            <section className="admin-panel asset-upload-panel">
              <div className="panel-heading"><div><span className="admin-kicker">UPLOAD TO S3</span><h3>Add a reusable asset</h3></div><span className="panel-index">01</span></div>
              <form className="admin-form" onSubmit={uploadAsset}>
                <label className="file-drop"><input type="file" accept="image/*,audio/*,video/*" onChange={(event) => { const file = event.target.files?.[0] || null; setUploadFile(file); if (file && !uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, "")); }} required /><span className="file-drop-symbol">↑</span><strong>{uploadFile?.name || "Choose an image, audio, or video file"}</strong><small>{uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : "Select a file from your device"}</small></label>
                <label className="admin-field"><span>ASSET TITLE</span><input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="A clear library name" required /></label>
                <label className="admin-field"><span>DESCRIPTION <small>OPTIONAL</small></span><textarea value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} rows={2} placeholder="Usage notes" /></label>
                <button className="admin-primary" type="submit" disabled={busy || !uploadFile}>{busy ? "Uploading..." : "Upload asset"}<span aria-hidden="true">↗</span></button>
                <small className="form-footnote">The file is uploaded to S3. The asset starts as DRAFT and can be published after the upload completes.</small>
              </form>
            </section>
            <section className="admin-panel asset-list-panel">
              <div className="panel-heading"><div><span className="admin-kicker">LIBRARY</span><h3>{catalog.assets.length} assets</h3></div><span className="panel-index">02</span></div>
              <div className="asset-list">
                {catalog.assets.map((asset) => <div className="asset-row" key={asset.id}><span className={`asset-kind asset-${asset.type.toLowerCase()}`}>{asset.type === "IMAGE" ? "IMG" : asset.type === "AUDIO" ? "AUD" : "VID"}</span><div className="asset-row-info"><strong>{asset.title}</strong><small>{asset.type} · {asset.location}</small></div>{publishButton("assets", asset.id, asset.visibility)}</div>)}
                {!catalog.assets.length && <p className="admin-sidebar-empty">Your reusable images and sounds will appear here.</p>}
              </div>
            </section>
          </div>}
        </section>
      </div>
    </main>
  );
}