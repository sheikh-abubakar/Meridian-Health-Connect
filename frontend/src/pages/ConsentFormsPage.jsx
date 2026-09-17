import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardSignature, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useRealtimeRevision } from "@/realtime/useRealtimeRevision";

const types = [
  ["static_text", "Information text"],
  ["checkbox", "Checkbox"],
  ["short_text", "Short answer"],
  ["yes_no", "Yes / No"],
  ["signature", "Signature"],
];
const typeLabel = Object.fromEntries(types);
const blankField = (type = "static_text") => ({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, type, label: "", required: type === "signature" });
const blankTemplate = () => ({ name: "", fields: [blankField()] });

function FieldPreview({ field }) {
  if (field.type === "static_text") return <p className="text-sm leading-6 text-slate-600">{field.label}</p>;
  if (field.type === "checkbox") return <p className="text-sm text-slate-700">☐ {field.label}</p>;
  if (field.type === "yes_no") return <p className="text-sm text-slate-700">{field.label} <span className="ml-2 text-slate-400">Yes / No</span></p>;
  if (field.type === "signature") return <p className="text-sm text-slate-700">{field.label || "Patient signature"} <span className="text-red-600">(required signature)</span></p>;
  return <p className="text-sm text-slate-700">{field.label} <span className="text-slate-400">— short answer</span></p>;
}

export function ConsentFormsPage() {
  const { tenantSlug, locationSlug } = useParams();
  const { session } = useAuth();
  const root = `/${tenantSlug}/${locationSlug}`;
  const headers = useMemo(() => ({ Authorization: `Bearer ${session.accessToken}` }), [session.accessToken]);
  const revision = useRealtimeRevision(["formtemplate:created", "formtemplate:updated"]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(blankTemplate);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest(`${root}/form-templates`, { headers })
      .then((data) => active && setTemplates(data.templates || []))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [headers, revision, root]);

  function updateField(index, next) {
    setForm((current) => ({ ...current, fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...next, required: (next.type || field.type) === "signature" ? true : (next.type || field.type) === "static_text" ? false : next.required ?? field.required } : field) }));
  }
  function move(index, direction) {
    setForm((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.fields.length) return current;
      const fields = [...current.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...current, fields };
    });
  }
  function edit(template) {
    setEditingId(template.id);
    setForm({ name: template.name, fields: template.fields.map((field) => ({ ...field })) });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function reset() {
    setEditingId("");
    setForm(blankTemplate());
    setError("");
  }
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await apiRequest(editingId ? `${root}/form-templates/${editingId}` : `${root}/form-templates`, {
        method: editingId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(form),
      });
      setTemplates((current) => editingId ? current.map((item) => item.id === editingId ? data.template : item) : [data.template, ...current]);
      setNotice(editingId ? "Consent form template updated." : "Consent form template created.");
      reset();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-teal-700">Patient portal setup</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight"><ClipboardSignature className="size-7 text-violet-700" /> Consent Forms</h1><p className="mt-2 max-w-3xl text-muted-foreground">Build digital intake and consent forms to assign to patients. Patient completion and signature capture will be enabled in the next workflow step.</p></div>
    {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <Card className="bg-white shadow-none"><CardHeader><CardTitle>{editingId ? "Edit consent form" : "Create consent form"}</CardTitle><CardDescription>Use information text for statements that patients read. Signature fields are always required.</CardDescription></CardHeader><CardContent><form className="space-y-5" onSubmit={save}>
      <label className="block text-sm font-medium">Template name<input className="mt-2 min-h-11 w-full rounded-md border bg-white px-3" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. New patient intake consent" required /></label>
      <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">Form fields</p><Button type="button" size="sm" variant="outline" onClick={() => setForm((current) => ({ ...current, fields: [...current.fields, blankField()] }))}><Plus className="mr-2 size-4" /> Add field</Button></div>
        {form.fields.map((field, index) => <div className="rounded-lg border bg-slate-50 p-4" key={field.id}><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end"><label className="text-sm font-medium">Field label<input className="mt-2 min-h-10 w-full rounded-md border bg-white px-3 font-normal" value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} placeholder={field.type === "signature" ? "Patient signature" : "Write field text"} required /></label><label className="text-sm font-medium">Field type<select className="mt-2 min-h-10 w-full rounded-md border bg-white px-3 font-normal" value={field.type} onChange={(event) => updateField(index, { type: event.target.value })}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex items-center gap-1"><Button type="button" size="icon" variant="ghost" aria-label="Move field up" onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Move field down" onClick={() => move(index, 1)} disabled={index === form.fields.length - 1}><ArrowDown className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Remove field" onClick={() => setForm((current) => ({ ...current, fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index) }))} disabled={form.fields.length === 1}><Trash2 className="size-4 text-red-600" /></Button></div></div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm"><span className="rounded-full bg-white px-2 py-1 text-xs text-slate-500">{typeLabel[field.type]}</span>{field.type === "signature" ? <span className="font-medium text-red-700">Required signature</span> : field.type !== "static_text" && <label className="flex items-center gap-2"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} /> Required response</label>}</div></div>)}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t pt-5"><Button type="button" variant="outline" onClick={reset}>Start new</Button><Button type="submit" className="bg-teal-700 hover:bg-teal-800" disabled={saving}><Save className="mr-2 size-4" />{saving ? "Saving..." : editingId ? "Save changes" : "Save template"}</Button></div>
    </form></CardContent></Card>
    <section><div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Available templates</h2><p className="mt-1 text-sm text-muted-foreground">Only templates in this branch are shown.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{templates.length} templates</span></div>
      {loading ? <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-100" /> : templates.length ? <div className="mt-4 grid gap-4 xl:grid-cols-2">{templates.map((template) => <Card key={template.id} className="bg-white shadow-none"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{template.name}</CardTitle><CardDescription>{template.fields.length} fields</CardDescription></div><Button size="sm" variant="outline" onClick={() => edit(template)}><Pencil className="mr-2 size-4" /> Edit</Button></div></CardHeader><CardContent><div className="space-y-3">{template.fields.map((field) => <div className="rounded-md border bg-slate-50 p-3" key={field.id}><FieldPreview field={field} /></div>)}</div></CardContent></Card>)}</div> : <div className="mt-4 rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">No consent form templates yet. Create the first one above.</div>}
    </section>
  </div>;
}
