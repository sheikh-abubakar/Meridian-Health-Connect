import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ClipboardSignature, Eraser, PenLine } from "lucide-react";
import { apiRequest } from "@/api/client";

const readableDate = (value) => new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", hour12: true, timeZone: "Asia/Karachi" }).format(new Date(value));

function SignatureCanvas({ value, onChange, readOnly = false }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const paint = (canvas) => {
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = value;
    }
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    paint(canvas);
  }, [value]);
  function point(event) {
    const canvas = canvasRef.current;
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) * (canvas.width / box.width), y: (event.clientY - box.top) * (canvas.height / box.height) };
  }
  function start(event) {
    if (readOnly) return;
    event.preventDefault();
    drawing.current = true;
    lastPoint.current = point(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function draw(event) {
    if (!drawing.current || readOnly) return;
    const canvas = canvasRef.current;
    const current = point(event);
    const context = canvas.getContext("2d");
    context.strokeStyle = "#0f172a";
    context.lineWidth = Math.max(2, canvas.width / 180);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(lastPoint.current.x, lastPoint.current.y);
    context.lineTo(current.x, current.y);
    context.stroke();
    lastPoint.current = current;
  }
  function stop() {
    if (!drawing.current || readOnly) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }
  function clear() {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }
  return <div><canvas ref={canvasRef} aria-label={readOnly ? "Submitted signature" : "Draw your signature"} className={`h-44 w-full rounded-xl border-2 bg-white ${readOnly ? "border-slate-200" : "cursor-crosshair border-dashed border-teal-300 touch-none"}`} onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerCancel={stop} />{!readOnly && <div className="mt-3 flex items-center justify-between gap-3"><p className="text-sm text-slate-600">Use your finger or mouse to sign in the box.</p><button type="button" onClick={clear} className="flex min-h-11 items-center gap-2 rounded-xl border px-3 font-semibold text-slate-700"><Eraser className="size-4" />Clear</button></div>}</div>;
}

function ReadOnlyField({ field, form }) {
  if (field.type === "static_text") return <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{field.label}</p>;
  if (field.type === "signature") return <div><p className="mb-2 font-semibold">{field.label}</p><SignatureCanvas value={form.signatureData} readOnly /></div>;
  const value = form.responses?.[field.id];
  const display = field.type === "checkbox" ? (value ? "Confirmed" : "Not confirmed") : field.type === "yes_no" ? (value === "yes" ? "Yes" : value === "no" ? "No" : "Not answered") : value || "Not answered";
  return <div className="rounded-xl border bg-white p-4"><p className="text-sm font-semibold">{field.label}</p><p className="mt-2 text-sm text-slate-600">{display}</p></div>;
}

function FormEditor({ form, headers, onBack, onSubmitted }) {
  const fields = form.formTemplate?.fields || [];
  const [responses, setResponses] = useState(form.responses || {});
  const [signatureData, setSignatureData] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requiredComplete = fields.every((field) => {
    if (!field.required) return true;
    if (field.type === "signature") return Boolean(signatureData);
    if (field.type === "checkbox") return responses[field.id] === true;
    if (field.type === "yes_no") return ["yes", "no"].includes(responses[field.id]);
    if (field.type === "static_text") return true;
    return Boolean(String(responses[field.id] || "").trim());
  });
  async function submit(event) {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      const data = await apiRequest(`/patient-portal/forms/${form.id}/submit`, { method: "POST", headers, body: JSON.stringify({ responses, signatureData }) });
      onSubmitted(data.form);
    } catch (requestError) { setError(requestError.message); } finally { setSubmitting(false); }
  }
  return <><button onClick={onBack} className="flex min-h-11 items-center gap-1 font-semibold text-teal-800"><ChevronLeft />Back to forms</button><div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm sm:p-7"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><ClipboardSignature className="size-6" /></span><div><h1 className="text-2xl font-bold">{form.formTemplate?.name}</h1><p className="mt-1 text-sm leading-6 text-slate-600">Please read each item carefully. Your information is sent securely to your clinic when you submit.</p></div></div><form className="mt-7 space-y-6" onSubmit={submit}>{fields.map((field) => <section key={field.id} className={field.type === "static_text" ? "" : "rounded-xl border bg-slate-50 p-4"}>{field.type === "static_text" ? <p className="leading-7 text-slate-700">{field.label}</p> : field.type === "checkbox" ? <label className="flex min-h-12 cursor-pointer items-start gap-3 text-base font-medium"><input type="checkbox" className="mt-1 size-5 accent-teal-700" checked={responses[field.id] === true} onChange={(event) => setResponses({ ...responses, [field.id]: event.target.checked })} /><span>{field.label}{field.required && <span className="ml-1 text-red-600">*</span>}</span></label> : field.type === "yes_no" ? <div><p className="font-semibold">{field.label}{field.required && <span className="ml-1 text-red-600">*</span>}</p><div className="mt-3 grid grid-cols-2 gap-3"><button type="button" onClick={() => setResponses({ ...responses, [field.id]: "yes" })} className={`min-h-12 rounded-xl border-2 font-bold ${responses[field.id] === "yes" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Yes</button><button type="button" onClick={() => setResponses({ ...responses, [field.id]: "no" })} className={`min-h-12 rounded-xl border-2 font-bold ${responses[field.id] === "no" ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}>No</button></div></div> : field.type === "signature" ? <div><p className="font-semibold">{field.label || "Your signature"} <span className="text-red-600">*</span></p><p className="mt-1 text-sm text-slate-600">Signing confirms the information above is correct.</p><div className="mt-3"><SignatureCanvas value={signatureData} onChange={setSignatureData} /></div></div> : <label className="block font-semibold">{field.label}{field.required && <span className="ml-1 text-red-600">*</span>}<input className="mt-3 min-h-12 w-full rounded-xl border bg-white px-3 font-normal" value={responses[field.id] || ""} maxLength="2000" onChange={(event) => setResponses({ ...responses, [field.id]: event.target.value })} /></label>}</section>)}{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}<button type="submit" disabled={!requiredComplete || submitting} className="min-h-13 w-full rounded-xl bg-teal-700 px-5 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-teal-300">{submitting ? "Submitting securely..." : "Submit form"}</button>{!requiredComplete && <p className="text-center text-sm text-slate-500">Complete all required fields, including your signature, to submit.</p>}</form></div></>;
}

export function PatientConsentForms({ forms, headers, onSubmitted, onBack, initialFormId = "" }) {
  const [selectedId, setSelectedId] = useState(initialFormId);
  const [confirmation, setConfirmation] = useState("");
  const selected = forms.find((form) => form.id === selectedId);
  const pending = forms.filter((form) => form.status === "pending");
  if (selected?.status === "pending") return <FormEditor form={selected} headers={headers} onBack={() => setSelectedId("")} onSubmitted={(form) => { onSubmitted(form); setConfirmation("Form submitted, thank you."); setSelectedId(""); }} />;
  return <><button onClick={onBack} className="flex min-h-11 items-center gap-1 font-semibold text-teal-800"><ChevronLeft />Back to portal</button><h1 className="mt-4 text-3xl font-bold">Your forms</h1><p className="mt-2 text-slate-600">Complete any pending forms when you are ready. Submitted forms stay here for your reference.</p>{confirmation && <p role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 className="size-5" />{confirmation}</p>}<section className="mt-6"><h2 className="text-lg font-bold">To complete ({pending.length})</h2><div className="mt-3 space-y-3">{pending.length ? pending.map((form) => <button key={form.id} onClick={() => setSelectedId(form.id)} className="flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-teal-300"><span><span className="block font-bold">{form.formTemplate?.name || "Consent form"}</span><span className="mt-1 block text-sm text-slate-500">Assigned {readableDate(form.assignedAt)}</span></span><span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">Complete</span></button>) : <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">You have no forms waiting to be completed.</p>}</div></section><section className="mt-8"><h2 className="text-lg font-bold">Submitted forms</h2><div className="mt-3 space-y-3">{forms.filter((form) => form.status === "completed").length ? forms.filter((form) => form.status === "completed").map((form) => <details key={form.id} className="rounded-2xl border bg-white p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span><span className="block font-bold">{form.formTemplate?.name || "Consent form"}</span><span className="mt-1 block text-sm text-slate-500">Submitted {readableDate(form.signedAt)}</span></span><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">Completed</span></summary><div className="mt-5 space-y-4 border-t pt-5">{(form.formTemplate?.fields || []).map((field) => <ReadOnlyField key={field.id} field={field} form={form} />)}</div></details>) : <p className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">Submitted forms will appear here.</p>}</div></section></>;
}
