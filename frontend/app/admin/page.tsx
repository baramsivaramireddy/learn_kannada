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
type Subsection = { id: string; title: string; description: string; sequence: number; visibility: Visibility; learningItems: LearningItem[]; quizItems: QuizItem[] };
type Section = { id: string; title: string; description: string; sequence: number; visibility: Visibility; subsections: Subsection[] };
type Catalog = { sections: Section[]; assets: Asset[] };
type OptionDraft = { id: string; type: ContentType; text: string; assetId: string; isCorrect: boolean };

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "https://dev.learnkannada.co.in/api").replace(/\/$/, "");

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

const adminFieldClass = "grid min-w-0 gap-1.5 text-[10px] font-semibold text-neutral-600 [&>span]:flex [&>span]:justify-between [&>span]:text-[9px] [&>span]:font-bold [&>span]:tracking-[.08em] [&>span>small]:text-neutral-400 [&_input]:min-h-[38px] [&_input]:w-full [&_input]:border [&_input]:border-neutral-200 [&_input]:bg-white [&_input]:px-2.5 [&_input]:py-2 [&_input]:text-[11px] [&_input]:font-normal [&_textarea]:min-h-16 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:border [&_textarea]:border-neutral-200 [&_textarea]:bg-white [&_textarea]:px-2.5 [&_textarea]:py-2 [&_textarea]:text-[11px] [&_textarea]:font-normal [&_select]:min-h-[38px] [&_select]:w-full [&_select]:border [&_select]:border-neutral-200 [&_select]:bg-white [&_select]:px-2.5 [&_select]:py-2 [&_select]:text-[11px] [&_select]:font-normal [&_input:focus]:outline-2 [&_textarea:focus]:outline-2 [&_select:focus]:outline-2 [&_input:focus]:outline-neutral-400 [&_textarea:focus]:outline-neutral-400 [&_select:focus]:outline-neutral-400";
const adminFormClass = "grid gap-3";
const adminPanelClass = "min-w-0 border border-neutral-200 bg-white p-5";
const panelHeadingClass = "mb-4 flex items-start justify-between gap-3.5";
const adminPrimaryClass = "flex min-h-[42px] items-center justify-between gap-4 bg-[#183e35] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#24594b] disabled:cursor-wait disabled:bg-neutral-400";

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
  const [editingSectionId, setEditingSectionId] = useState("");
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [editSectionDescription, setEditSectionDescription] = useState("");
  const [editSectionSequence, setEditSectionSequence] = useState("1");
  const [subsectionTitle, setSubsectionTitle] = useState("");
  const [subsectionDescription, setSubsectionDescription] = useState("");
  const [subsectionSequence, setSubsectionSequence] = useState("1");
  const [editingSubsectionId, setEditingSubsectionId] = useState("");
  const [editSubsectionTitle, setEditSubsectionTitle] = useState("");
  const [editSubsectionDescription, setEditSubsectionDescription] = useState("");
  const [editSubsectionSequence, setEditSubsectionSequence] = useState("1");
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
          visibility: "DRAFT",
        }),
      });
      await loadCatalog(token);
      setSelectedSubsectionId(response.subsection.id);
      setSubsectionTitle("");
      setSubsectionDescription("");
      setSubsectionSequence(String(selectedSection.subsections.length + 2));
    }, "Draft lesson created.");
  };

  const beginSectionEdit = (section: Section) => {
    setEditingSectionId(section.id);
    setEditSectionTitle(section.title);
    setEditSectionDescription(section.description);
    setEditSectionSequence(String(section.sequence));
  };

  const saveSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingSectionId) return;
    void runAction(async () => {
      await apiRequest(`/admin/sections/${editingSectionId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ title: editSectionTitle, description: editSectionDescription, sequence: Number(editSectionSequence) }),
      });
      await loadCatalog(token);
      setEditingSectionId("");
    }, "Section updated.");
  };

  const deleteSection = (section: Section) => {
    const childData = section.subsections.length
      ? ` This also deletes ${section.subsections.length} subsection${section.subsections.length === 1 ? "" : "s"}, their learning items, and quizzes.`
      : "";
    if (!window.confirm(`Delete section "${section.title}"?${childData} This cannot be undone.`)) return;
    void runAction(async () => {
      await apiRequest(`/admin/sections/${section.id}`, token, { method: "DELETE" });
      setEditingSectionId("");
      setEditingSubsectionId("");
      setSelectedSectionId("");
      setSelectedSubsectionId("");
      await loadCatalog(token);
    }, "Section deleted.");
  };

  const beginSubsectionEdit = (subsection: Subsection) => {
    setEditingSubsectionId(subsection.id);
    setEditSubsectionTitle(subsection.title);
    setEditSubsectionDescription(subsection.description);
    setEditSubsectionSequence(String(subsection.sequence));
  };

  const saveSubsection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingSubsectionId) return;
    void runAction(async () => {
      await apiRequest(`/admin/subsections/${editingSubsectionId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ title: editSubsectionTitle, description: editSubsectionDescription, sequence: Number(editSubsectionSequence) }),
      });
      await loadCatalog(token);
      setEditingSubsectionId("");
    }, "Subsection updated.");
  };

  const deleteSubsection = (subsection: Subsection) => {
    if (!window.confirm(`Delete subsection "${subsection.title}"? Its learning items and quiz data will also be deleted. This cannot be undone.`)) return;
    void runAction(async () => {
      await apiRequest(`/admin/subsections/${subsection.id}`, token, { method: "DELETE" });
      setEditingSubsectionId("");
      setSelectedSubsectionId("");
      await loadCatalog(token);
    }, "Subsection deleted.");
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
    if (!selectedSubsection) return;
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
          subsectionId: selectedSubsection.id,
          type: quizType,
          sequence: Number(quizSequence),
          question,
          options: optionPayload,
        }),
      });
      await loadCatalog(token);
      setQuestionText("");
      setQuestionAssetId("");
      setQuizSequence(String(selectedSubsection.quizItems.length + 2));
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
    <label className={adminFieldClass}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">No asset</option>
        {catalog.assets.filter((asset) => asset.type === type).map((asset) => <option key={asset.id} value={asset.id}>{asset.title} · {asset.visibility}</option>)}
      </select>
    </label>
  );

  const publishButton = (resource: string, id: string, visibility: Visibility) => (
    <button className={`inline-flex min-h-7 items-center justify-center gap-1.5 border px-2 text-[9px] whitespace-nowrap disabled:cursor-wait disabled:opacity-50 ${visibility === "PUBLIC" ? "border-green-200 bg-green-50 text-green-800" : "border-neutral-200 bg-white text-neutral-600"}`} disabled={busy} onClick={() => setVisibility(resource, id, visibility === "PUBLIC" ? "DRAFT" : "PUBLIC")}>
      <span className={`size-1.5 rounded-full ${visibility === "PUBLIC" ? "bg-green-600" : "bg-amber-500"}`} />{visibility === "PUBLIC" ? "Published" : "Publish"}
    </button>
  );

  if (!token) {
    return (
      <main className="grid min-h-screen bg-neutral-50 text-neutral-900 lg:grid-cols-[minmax(260px,.85fr)_minmax(400px,1.15fr)]">
        <div className="relative hidden min-h-screen overflow-hidden bg-[#183e35] px-[clamp(24px,5vw,70px)] py-8 text-white lg:block"><Link className="relative z-10 inline-flex items-center gap-2.5 text-[15px] font-bold text-white no-underline" href="/" aria-label="Learn Kannada home"><span className="grid size-8 place-items-center bg-[#c54832] text-xl" lang="kn">ಅ</span><span>learn<span className="text-amber-300">kannada</span></span></Link><div className="absolute left-[14%] top-[27%] font-serif text-[clamp(46px,7vw,90px)] leading-[1.35] text-amber-300" lang="kn">ಅಕ್ಷರ<br />ಅರ್ಥ<br />ಅಭ್ಯಾಸ</div><p className="absolute bottom-[8%] left-[14%] m-0 font-serif text-[15px] italic text-green-100/75">Words begin here.</p></div>
        <section className="mx-auto w-full max-w-[480px] self-center px-6 py-14 sm:px-[42px]">
          <span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">CONTENT STUDIO <span className="px-1 text-[#c54832]">·</span> PRIVATE</span>
          <h1 className="mb-3 mt-5 font-serif text-[clamp(39px,5vw,56px)] font-medium leading-[1.03]">Make room<br />for a new word.</h1>
          <p className="mb-7 max-w-[330px] text-[13px] leading-[1.7] text-neutral-600">Sign in with your content admin token to create and publish Kannada lessons.</p>
          <form className={`${adminFormClass} gap-4`} onSubmit={unlock}>
            <label className={adminFieldClass}><span>CONTENT ADMIN TOKEN</span><input type="password" autoComplete="current-password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="Paste your token" required /></label>
            {error && <p className="border-l-[3px] border-red-700 bg-red-50 px-3 py-2.5 text-[11px] leading-relaxed text-red-900" role="alert">{error}</p>}
            <button className={adminPrimaryClass} type="submit" disabled={busy}>{busy ? "Checking token..." : "Open content studio"}<span aria-hidden="true">↗</span></button>
          </form>
          <Link className="mt-6 inline-block text-[11px] text-neutral-600 no-underline hover:text-[#c54832]" href="/">← Return to learner view</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-[clamp(18px,4vw,56px)] max-[640px]:h-[59px] max-[640px]:px-3.5">
        <Link className="inline-flex items-center gap-2.5 text-[15px] font-bold text-neutral-900 no-underline" href="/" aria-label="Learn Kannada home"><span className="grid size-8 place-items-center bg-[#c54832] text-xl text-white" lang="kn">ಅ</span><span>learn<span className="text-[#c54832]">kannada</span></span></Link>
        <div className="flex items-center gap-5 max-[640px]:gap-3"><span className="inline-flex items-center gap-2 text-[9px] font-bold tracking-[.12em] text-neutral-600 max-[640px]:text-[7px]"><span className="size-1.5 rounded-full bg-green-600" /> CONTENT STUDIO</span><Link className="text-[11px] text-neutral-600 no-underline hover:text-[#c54832] max-[640px]:text-[9px]" href="/">Learner view ↗</Link><button className="grid size-[33px] place-items-center border border-neutral-200 bg-white text-lg text-neutral-700" onClick={logout} title="Lock content studio" aria-label="Lock content studio">⌑</button></div>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-[1500px] grid-cols-[255px_minmax(0,1fr)] max-[900px]:grid-cols-[220px_minmax(0,1fr)] max-[640px]:min-h-[calc(100vh-59px)] max-[640px]:grid-cols-1">
        <aside className="min-h-[calc(100vh-64px)] border-r border-neutral-200 bg-white px-4 py-7 max-[640px]:min-h-0 max-[640px]:border-r-0 max-[640px]:border-b max-[640px]:px-3.5 max-[640px]:py-4">
          <div className="mb-6 flex items-end justify-between px-2"><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">WORKSPACE</span><h1 className="mb-0 mt-1.5 font-serif text-[26px] font-medium max-[640px]:text-[22px]">Content</h1></div><span className="font-mono text-[11px] text-neutral-400">{String(catalog.sections.length).padStart(2, "0")}</span></div>
          <div className="mb-5 grid grid-cols-2 gap-1 bg-neutral-100 p-1 max-[640px]:mb-3" role="tablist" aria-label="Admin workspace">
            <button role="tab" aria-selected={activePanel === "content"} className={`min-h-[35px] text-[11px] ${activePanel === "content" ? "bg-white font-semibold text-neutral-900 shadow-sm" : "text-neutral-500"}`} onClick={() => setActivePanel("content")}>Lessons</button>
            <button role="tab" aria-selected={activePanel === "assets"} className={`min-h-[35px] text-[11px] ${activePanel === "assets" ? "bg-white font-semibold text-neutral-900 shadow-sm" : "text-neutral-500"}`} onClick={() => setActivePanel("assets")}>Assets <span className="ml-1 text-[9px] text-neutral-500">{catalog.assets.length}</span></button>
          </div>
          {activePanel === "content" && <>
            <div className="px-2 pb-2 text-[9px] font-bold tracking-[.12em] text-neutral-500">SECTIONS</div>
            <div className="grid gap-1 max-[640px]:max-h-32 max-[640px]:overflow-y-auto">
              {catalog.sections.map((section, index) => (
                <div key={section.id}>
                  <div className="flex items-center gap-1">
                    <button className={`grid min-h-10 min-w-0 flex-1 grid-cols-[21px_minmax(0,1fr)_6px] items-center gap-1.5 px-2 text-left ${section.id === selectedSection?.id ? "bg-neutral-100 text-neutral-900" : "text-neutral-600 hover:bg-neutral-50"}`} onClick={() => { setSelectedSectionId(section.id); setSelectedSubsectionId(section.subsections[0]?.id || ""); setEditingSectionId(""); setEditingSubsectionId(""); }}>
                      <span className="font-mono text-[9px] text-neutral-400">{String(index + 1).padStart(2, "0")}</span><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold">{section.title}</strong><i className={`size-1.5 rounded-full ${section.visibility === "PUBLIC" ? "bg-green-600" : "bg-amber-500"}`} />
                    </button>
                    {publishButton("sections", section.id, section.visibility)}
                  </div>
                  {section.id === selectedSection?.id && section.subsections.map((subsection) => (
                    <button key={subsection.id} className={`ml-[19px] flex min-h-8 w-[calc(100%-19px)] items-center gap-2 px-2 text-left text-[10px] ${subsection.id === selectedSubsection?.id ? "text-[#c54832]" : "text-neutral-500 hover:text-neutral-800"}`} onClick={() => { setSelectedSubsectionId(subsection.id); setEditingSubsectionId(""); }}><span className={`size-1 rounded-full ${subsection.id === selectedSubsection?.id ? "bg-[#c54832]" : "bg-neutral-400"}`} />{subsection.title}</button>
                  ))}
                </div>
              ))}
              {catalog.sections.length === 0 && <p className="my-3 text-[11px] leading-relaxed text-neutral-500">No sections yet. Add your first section below.</p>}
            </div>
          </>}
          <div className="mt-8 flex items-center gap-2 border-t border-neutral-200 pt-4 text-[9px] leading-relaxed text-neutral-500 max-[640px]:hidden"><span className="grid size-6 place-items-center bg-neutral-100 text-sm text-neutral-700">⌑</span><span>Token held in memory<br />for this page session.</span></div>
        </aside>

        <section className="min-w-0 bg-neutral-50 px-[clamp(22px,4.5vw,66px)] pb-[70px] pt-9 max-[900px]:px-[22px] max-[640px]:px-3.5 max-[640px]:pb-[42px] max-[640px]:pt-5">
          <div className="flex min-h-[125px] items-center justify-between gap-5 border-b border-neutral-200"><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">{activePanel === "content" ? "LESSON BUILDER" : "MEDIA LIBRARY"} <span className="px-1 text-[#c54832]">·</span> {catalog.sections.length} SECTIONS</span><h2 className="mb-1 mt-2 font-serif text-[32px] font-medium leading-tight text-neutral-900 max-[640px]:text-[27px]">{activePanel === "content" ? "Build a learning path." : "Reusable assets."}</h2><p className="mb-4 mt-0 max-w-[560px] text-xs leading-relaxed text-neutral-600">{activePanel === "content" ? "Draft the structure, add learning material, then publish when it is ready." : "Upload once, reference audio and images anywhere in your content."}</p></div><div className="hidden size-12 place-items-center border border-neutral-200 text-2xl text-neutral-500 sm:grid" lang="kn">ಕ</div></div>
          {error && <div className="mb-0 mt-4 border-l-[3px] border-red-700 bg-red-50 px-3 py-2.5 text-[11px] leading-relaxed text-red-900" role="alert">{error}</div>}
          {notice && <div className="mb-0 mt-4 border-l-[3px] border-green-700 bg-green-50 px-3 py-2.5 text-[11px] leading-relaxed text-green-900" role="status">{notice}</div>}

          {activePanel === "content" ? <div className="grid grid-cols-2 items-start gap-[15px] pt-5 max-[900px]:grid-cols-1">
            <section className={adminPanelClass}>
              <div className={panelHeadingClass}><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">01 / COURSE STRUCTURE</span><h3 className="mb-0 mt-1.5 font-serif text-xl font-medium">{editingSectionId ? "Edit section" : "Add a section"}</h3></div><span className="font-mono text-[11px] text-neutral-400">01</span></div>
              {selectedSection && <div className="-mt-1 mb-3.5 flex items-center gap-1.5"><span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-neutral-500">Selected: {selectedSection.title}</span><button type="button" className="min-h-7 border border-neutral-200 bg-white px-2 text-[9px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={busy} onClick={() => editingSectionId === selectedSection.id ? setEditingSectionId("") : beginSectionEdit(selectedSection)}>{editingSectionId === selectedSection.id ? "Cancel" : "Edit"}</button><button type="button" className="min-h-7 border border-red-200 bg-white px-2 text-[9px] text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={() => deleteSection(selectedSection)}>Delete</button></div>}
              {editingSectionId ? <form className={adminFormClass} onSubmit={saveSection}>
                <label className={adminFieldClass}><span>SECTION TITLE</span><input value={editSectionTitle} onChange={(event) => setEditSectionTitle(event.target.value)} required /></label>
                <label className={adminFieldClass}><span>DESCRIPTION</span><textarea value={editSectionDescription} onChange={(event) => setEditSectionDescription(event.target.value)} rows={2} /></label>
                <label className={adminFieldClass}><span>ORDER</span><input type="number" step="0.1" value={editSectionSequence} onChange={(event) => setEditSectionSequence(event.target.value)} required /></label>
                <button className={adminPrimaryClass} type="submit" disabled={busy}>{busy ? "Saving..." : "Save section"}<span aria-hidden="true">✓</span></button>
              </form> : <form className={adminFormClass} onSubmit={createSection}>
                <label className={adminFieldClass}><span>SECTION TITLE</span><input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="e.g. First words" required /></label>
                <label className={adminFieldClass}><span>DESCRIPTION</span><textarea value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} rows={2} placeholder="What will learners discover?" /></label>
                <label className={adminFieldClass}><span>ORDER</span><input type="number" step="0.1" value={sectionSequence} onChange={(event) => setSectionSequence(event.target.value)} required /></label>
                <button className={adminPrimaryClass} type="submit" disabled={busy}>Create draft section <span aria-hidden="true">+</span></button>
              </form>}
            </section>

            <section className={adminPanelClass}>
              <div className={panelHeadingClass}><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">02 / LESSON STRUCTURE</span><h3 className="mb-0 mt-1.5 font-serif text-xl font-medium">Add a subsection</h3></div><span className="font-mono text-[11px] text-neutral-400">02</span></div>
              {selectedSection ? <form className={adminFormClass} onSubmit={createSubsection}>
                <div className="flex justify-between gap-2.5 bg-neutral-100 px-2.5 py-2"><span className="text-[8px] font-bold tracking-[.1em] text-neutral-500">IN SECTION</span><strong className="text-[10px] text-[#183e35]">{selectedSection.title}</strong></div>
                <label className={adminFieldClass}><span>LESSON TITLE</span><input value={subsectionTitle} onChange={(event) => setSubsectionTitle(event.target.value)} placeholder="e.g. At home" required /></label>
                <label className={adminFieldClass}><span>DESCRIPTION</span><textarea value={subsectionDescription} onChange={(event) => setSubsectionDescription(event.target.value)} rows={2} placeholder="A short learning objective" /></label>
                <label className={adminFieldClass}><span>ORDER</span><input type="number" step="0.1" value={subsectionSequence} onChange={(event) => setSubsectionSequence(event.target.value)} required /></label>
                <button className={adminPrimaryClass} type="submit" disabled={busy}>Create subsection <span aria-hidden="true">+</span></button>
              </form> : <p className="my-3 text-[11px] leading-relaxed text-neutral-500">Create or select a section to add a lesson.</p>}
            </section>

            <section className={`${adminPanelClass} col-span-2 max-[900px]:col-span-1`}>
              <div className={`${panelHeadingClass} items-center`}><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">03 / SELECTED LESSON</span><h3 className="mb-0 mt-1.5 font-serif text-xl font-medium">{selectedSubsection?.title || "Choose a subsection"}</h3></div>{selectedSubsection && <div className="flex flex-wrap items-center justify-end gap-1.5"><button type="button" className="min-h-7 border border-neutral-200 bg-white px-2 text-[9px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50" disabled={busy} onClick={() => editingSubsectionId === selectedSubsection.id ? setEditingSubsectionId("") : beginSubsectionEdit(selectedSubsection)}>{editingSubsectionId === selectedSubsection.id ? "Cancel" : "Edit"}</button><button type="button" className="min-h-7 border border-red-200 bg-white px-2 text-[9px] text-red-700 hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={() => deleteSubsection(selectedSubsection)}>Delete</button>{publishButton("subsections", selectedSubsection.id, selectedSubsection.visibility)}</div>}</div>
              {selectedSubsection ? <>
                {editingSubsectionId === selectedSubsection.id && <form className="mb-4 grid max-w-[460px] gap-3 bg-neutral-50 p-3.5" onSubmit={saveSubsection}>
                  <label className={adminFieldClass}><span>LESSON TITLE</span><input value={editSubsectionTitle} onChange={(event) => setEditSubsectionTitle(event.target.value)} required /></label>
                  <label className={adminFieldClass}><span>DESCRIPTION</span><textarea value={editSubsectionDescription} onChange={(event) => setEditSubsectionDescription(event.target.value)} rows={2} /></label>
                  <label className={adminFieldClass}><span>ORDER</span><input type="number" step="0.1" value={editSubsectionSequence} onChange={(event) => setEditSubsectionSequence(event.target.value)} required /></label>
                  <button className={adminPrimaryClass} type="submit" disabled={busy}>{busy ? "Saving..." : "Save subsection"}<span aria-hidden="true">✓</span></button>
                </form>}
                <div className="flex flex-wrap gap-4 border-y border-neutral-200 py-2.5 text-[9px] text-neutral-500"><span>{selectedSection?.title}</span><span>{selectedSubsection.learningItems.length} learning items</span><span>{selectedSubsection.quizItems.length} quiz questions</span></div>
                <div className="grid">
                  {selectedSubsection.learningItems.map((item) => <div className="grid min-h-[49px] grid-cols-[65px_minmax(80px,.8fr)_minmax(80px,1fr)_auto] items-center gap-[11px] border-b border-neutral-100 max-[640px]:grid-cols-[55px_minmax(45px,.7fr)_minmax(50px,1fr)_auto] max-[640px]:gap-1.5" key={item.id}><span className="w-max bg-neutral-100 px-1.5 py-1 text-[8px] font-bold tracking-wide text-[#183e35]">{item.type}</span><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-neutral-900 max-[640px]:text-[9px]" lang="kn">{item.type === "WORD" ? item.word : item.sound}</strong><span className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-neutral-500 max-[640px]:text-[8px]">{item.type === "WORD" ? item.meaning : item.description}</span>{publishButton("learning-items", item.id, item.visibility)}</div>)}
                  {selectedSubsection.quizItems.map((item) => <div className="grid min-h-[49px] grid-cols-[65px_minmax(80px,.8fr)_minmax(80px,1fr)_auto] items-center gap-[11px] border-b border-neutral-100 max-[640px]:grid-cols-[55px_minmax(45px,.7fr)_minmax(50px,1fr)_auto] max-[640px]:gap-1.5" key={item.id}><span className="w-max bg-red-50 px-1.5 py-1 text-[8px] font-bold tracking-wide text-red-800">{item.type}</span><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-neutral-900 max-[640px]:text-[9px]">Question {item.sequence}</strong><span className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-neutral-500 max-[640px]:text-[8px]">{item.questionText || item.questionAsset?.title || item.options.length + " options"}</span>{publishButton("quiz-items", item.id, item.visibility)}</div>)}
                  {!selectedSubsection.learningItems.length && !selectedSubsection.quizItems.length && <p className="my-3 text-[11px] leading-relaxed text-neutral-500">This subsection is empty. Add learning material or quiz questions below.</p>}
                </div>
              </> : <p className="my-3 text-[11px] leading-relaxed text-neutral-500">Select a lesson in the left navigation to manage its content.</p>}
            </section>

            {selectedSubsection && <>
              <section className={adminPanelClass}>
                <div className={panelHeadingClass}><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">04 / LEARNING MATERIAL</span><h3 className="mb-0 mt-1.5 font-serif text-xl font-medium">Add a learning item</h3></div><span className="font-mono text-[11px] text-neutral-400">04</span></div>
                <form className={adminFormClass} onSubmit={createLearningItem}>
                  <div className="grid grid-cols-2 gap-[11px] max-[640px]:grid-cols-1"><label className={adminFieldClass}><span>ITEM TYPE</span><select value={learningType} onChange={(event) => setLearningType(event.target.value as "WORD" | "SOUND")}><option value="WORD">Word</option><option value="SOUND">Sound</option></select></label><label className={adminFieldClass}><span>ORDER</span><input type="number" step="0.1" value={learningSequence} onChange={(event) => setLearningSequence(event.target.value)} required /></label></div>
                  {learningType === "WORD" ? <><label className={adminFieldClass}><span>KANNADA WORD</span><input value={word} onChange={(event) => setWord(event.target.value)} lang="kn" placeholder="ಮನೆ" required /></label><label className={adminFieldClass}><span>MEANING</span><input value={meaning} onChange={(event) => setMeaning(event.target.value)} placeholder="House" required /></label>{assetSelect("IMAGE ASSET", "IMAGE", learningImageId, setLearningImageId)}</> : <><label className={adminFieldClass}><span>SOUND</span><input value={sound} onChange={(event) => setSound(event.target.value)} lang="kn" placeholder="ಅ" required /></label><label className={adminFieldClass}><span>DESCRIPTION</span><input value={learningDescription} onChange={(event) => setLearningDescription(event.target.value)} placeholder="Kannada vowel sound" /></label></>}
                  {assetSelect("AUDIO ASSET", "AUDIO", learningAudioId, setLearningAudioId)}
                  <button className={adminPrimaryClass} type="submit" disabled={busy}>Add draft item <span aria-hidden="true">+</span></button>
                </form>
              </section>

              <section className={adminPanelClass}>
                <div className={panelHeadingClass}><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">05 / ASSESSMENT</span><h3 className="mb-0 mt-1.5 font-serif text-xl font-medium">Add a quiz question</h3></div><span className="font-mono text-[11px] text-neutral-400">05</span></div>
                <form className={adminFormClass} onSubmit={createQuizItem}>
                  <div className="grid grid-cols-2 gap-[11px] max-[640px]:grid-cols-1"><label className={adminFieldClass}><span>QUESTION TYPE</span><select value={quizType} onChange={(event) => { const nextType = event.target.value as "SCQ" | "MCQ" | "SOUND"; setQuizType(nextType); if (nextType === "SOUND") setQuestionType("AUDIO"); }}><option value="SCQ">Single choice</option><option value="MCQ">Multiple choice</option><option value="SOUND">Sound question</option></select></label><label className={adminFieldClass}><span>ORDER</span><input type="number" step="0.1" value={quizSequence} onChange={(event) => setQuizSequence(event.target.value)} required /></label></div>
                  {quizType !== "SOUND" && <label className={adminFieldClass}><span>QUESTION CONTENT</span><select value={questionType} onChange={(event) => setQuestionType(event.target.value as ContentType)}><option value="TEXT">Text</option><option value="IMAGE">Image</option><option value="AUDIO">Audio</option></select></label>}
                  {(quizType === "SOUND" ? "AUDIO" : questionType) === "TEXT" ? <label className={adminFieldClass}><span>QUESTION</span><textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={2} placeholder="What does ಮನೆ mean?" required /></label> : assetSelect("QUESTION ASSET", quizType === "SOUND" || questionType === "AUDIO" ? "AUDIO" : "IMAGE", questionAssetId, setQuestionAssetId)}
                  <div className="flex justify-between gap-2 text-[8px] font-bold tracking-[.08em] text-neutral-600"><span>ANSWER OPTIONS</span><span className="text-right text-red-800">{quizType === "MCQ" ? "MARK ALL CORRECT" : "MARK THE CORRECT ANSWER"}</span></div>
                  {options.map((option, index) => <div className="grid grid-cols-[22px_minmax(70px,.65fr)_minmax(80px,1fr)_25px_22px] items-center gap-[5px] max-[640px]:grid-cols-[18px_minmax(59px,.7fr)_minmax(65px,1fr)_23px_18px] max-[640px]:gap-[3px]" key={option.id}>
                    <span className="text-center font-mono text-[10px] text-neutral-500">{String.fromCharCode(65 + index)}</span>
                    <select className="min-h-[34px] w-full min-w-0 border border-neutral-200 bg-white p-1.5 text-[9px] focus:outline-2 focus:outline-neutral-400 max-[640px]:px-1" aria-label={`Option ${index + 1} content type`} value={option.type} onChange={(event) => updateOption(index, { type: event.target.value as ContentType })}><option value="TEXT">Text</option><option value="IMAGE">Image</option><option value="AUDIO">Audio</option></select>
                    {option.type === "TEXT" ? <input className="min-h-[34px] w-full min-w-0 border border-neutral-200 bg-white p-1.5 text-[9px] focus:outline-2 focus:outline-neutral-400 max-[640px]:px-1" aria-label={`Option ${index + 1} text`} value={option.text} onChange={(event) => updateOption(index, { text: event.target.value })} placeholder={`Option ${String.fromCharCode(65 + index)}`} required /> : <select className="min-h-[34px] w-full min-w-0 border border-neutral-200 bg-white p-1.5 text-[9px] focus:outline-2 focus:outline-neutral-400 max-[640px]:px-1" aria-label={`Option ${index + 1} asset`} value={option.assetId} onChange={(event) => updateOption(index, { assetId: event.target.value })} required><option value="">Choose asset</option>{catalog.assets.filter((asset) => asset.type === (option.type === "IMAGE" ? "IMAGE" : "AUDIO")).map((asset) => <option value={asset.id} key={asset.id}>{asset.title} · {asset.visibility}</option>)}</select>}
                    <label className="relative grid size-6 cursor-pointer place-items-center text-neutral-400" title="Mark correct"><input className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0" type={quizType === "MCQ" ? "checkbox" : "radio"} name="correct-option" checked={option.isCorrect} onChange={(event) => markCorrect(index, event.target.checked)} aria-label={`Option ${index + 1} is correct`} /><span className="grid size-[19px] place-items-center rounded-full border border-neutral-300 bg-white text-[0px] peer-checked:border-[#183e35] peer-checked:bg-[#183e35] peer-checked:text-[11px] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-amber-400 peer-focus-visible:outline-offset-2">✓</span></label>
                    <button className="h-[25px] w-[22px] text-[17px] text-neutral-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-25" type="button" title="Remove option" aria-label={`Remove option ${index + 1}`} disabled={options.length <= 2} onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}>×</button>
                  </div>)}
                  <button className="w-max py-1 text-[10px] font-semibold text-[#183e35] hover:text-[#c54832]" type="button" onClick={() => setOptions((current) => [...current, emptyOption(current.length)])}>+ Add option</button>
                  <button className={adminPrimaryClass} type="submit" disabled={busy}>Add draft question <span aria-hidden="true">+</span></button>
                </form>
              </section>
            </>}
          </div> : <div className="grid grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)] items-start gap-[15px] pt-5 max-[900px]:grid-cols-1">
            <section className={adminPanelClass}>
              <div className={panelHeadingClass}><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">UPLOAD TO S3</span><h3 className="mb-0 mt-1.5 font-serif text-xl font-medium">Add a reusable asset</h3></div><span className="font-mono text-[11px] text-neutral-400">01</span></div>
              <form className={adminFormClass} onSubmit={uploadAsset}>
                <label className="flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center focus-within:outline-2 focus-within:outline-neutral-400"><input className="sr-only" type="file" accept="image/*,audio/*,video/*" onChange={(event) => { const file = event.target.files?.[0] || null; setUploadFile(file); if (file && !uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, "")); }} required /><span className="grid size-7 place-items-center bg-neutral-200 text-lg text-neutral-700">↑</span><strong className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-neutral-800">{uploadFile?.name || "Choose an image, audio, or video file"}</strong><small className="text-[9px] text-neutral-500">{uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : "Select a file from your device"}</small></label>
                <label className={adminFieldClass}><span>ASSET TITLE</span><input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="A clear library name" required /></label>
                <label className={adminFieldClass}><span>DESCRIPTION <small>OPTIONAL</small></span><textarea value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} rows={2} placeholder="Usage notes" /></label>
                <button className={adminPrimaryClass} type="submit" disabled={busy || !uploadFile}>{busy ? "Uploading..." : "Upload asset"}<span aria-hidden="true">↗</span></button>
                <small className="text-[9px] leading-relaxed text-neutral-500">The file is uploaded to S3. The asset starts as DRAFT and can be published after the upload completes.</small>
              </form>
            </section>
            <section className={adminPanelClass}>
              <div className={panelHeadingClass}><div><span className="text-[9px] font-bold tracking-[.12em] text-neutral-500">LIBRARY</span><h3 className="mb-0 mt-1.5 font-serif text-xl font-medium">{catalog.assets.length} assets</h3></div><span className="font-mono text-[11px] text-neutral-400">02</span></div>
              <div className="grid">
                {catalog.assets.map((asset) => <div className="grid min-h-[58px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-neutral-100" key={asset.id}><span className={`grid h-[27px] w-[31px] place-items-center font-mono text-[8px] ${asset.type === "IMAGE" ? "bg-neutral-100 text-neutral-700" : asset.type === "AUDIO" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{asset.type === "IMAGE" ? "IMG" : asset.type === "AUDIO" ? "AUD" : "VID"}</span><div className="grid min-w-0 gap-1"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px]">{asset.title}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[8px] text-neutral-500">{asset.type} · {asset.location}</small></div>{publishButton("assets", asset.id, asset.visibility)}</div>)}
                {!catalog.assets.length && <p className="my-3 text-[11px] leading-relaxed text-neutral-500">Your reusable images and sounds will appear here.</p>}
              </div>
            </section>
          </div>}
        </section>
      </div>
    </main>
  );
}