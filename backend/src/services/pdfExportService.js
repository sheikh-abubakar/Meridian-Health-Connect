import PDFDocument from "pdfkit";

const palette = {
  teal: "#0f766e",
  tealLight: "#ccfbf1",
  navy: "#0f172a",
  text: "#1e293b",
  muted: "#64748b",
  border: "#cbd5e1",
  soft: "#f8fafc",
  violet: "#6d28d9",
  violetSoft: "#f5f3ff",
};
const left = 48;
const contentWidth = 499;

function clean(value, fallback = "Not recorded") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function dateTime(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "Asia/Karachi",
  }).format(new Date(value));
}

function createDocument(res, filename) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, right: 48, bottom: 84, left: 48 },
    bufferPages: true,
    info: { Title: filename, Author: "Meridian Health Connect", Subject: "Patient-authorized health record export" },
  });
  res.status(200);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "no-store, private",
  });
  doc.pipe(res);
  return doc;
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function letterhead(doc, tenant, location, documentTitle, attendingPhysician = "") {
  doc.rect(0, 0, doc.page.width, 126).fill(palette.navy);
  doc.roundedRect(left, 30, 52, 52, 12).fill(palette.teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(25).text("+", 63, 39, { width: 22, align: "center", lineBreak: false });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20).text(tenant.name, 116, 31, { width: 431, lineBreak: false });
  doc.fillColor("#99f6e4").font("Helvetica-Bold").fontSize(10).text(location.name, 116, 59, { width: 431, lineBreak: false });
  doc.fillColor("#cbd5e1").font("Helvetica").fontSize(9).text(clean(location.address, "Address not recorded"), 116, 76, { width: 431, lineBreak: false });
  doc.rect(0, 112, doc.page.width, 14).fill(palette.teal);
  doc.fillColor(palette.navy).font("Helvetica-Bold").fontSize(19).text(documentTitle, left, 149);
  if (attendingPhysician) {
    doc.roundedRect(left, 181, contentWidth, 42, 6).fillAndStroke("#f0fdfa", "#99f6e4");
    doc.fillColor(palette.muted).font("Helvetica-Bold").fontSize(7.5).text("ATTENDING PHYSICIAN", left + 14, 191, { characterSpacing: 0.6, lineBreak: false });
    doc.fillColor(palette.teal).font("Helvetica-Bold").fontSize(13).text(clean(attendingPhysician), left + 168, 187, { width: contentWidth - 182, lineBreak: false, ellipsis: true });
    doc.y = 242;
  } else {
    doc.fillColor(palette.muted).font("Helvetica").fontSize(9).text("Meridian Health Connect | Patient record export", left, 176);
    doc.y = 202;
  }
}

function sectionHeading(doc, title, subtitle = "") {
  ensureSpace(doc, subtitle ? 48 : 36);
  doc.moveDown(0.5);
  doc.fillColor(palette.teal).font("Helvetica-Bold").fontSize(10).text(title.toUpperCase(), left, doc.y, { characterSpacing: 0.8 });
  const lineY = doc.y + 5;
  doc.moveTo(left, lineY).lineTo(left + contentWidth, lineY).strokeColor(palette.border).lineWidth(0.7).stroke();
  doc.y = lineY + 10;
  if (subtitle) {
    doc.fillColor(palette.muted).font("Helvetica").fontSize(8.5).text(subtitle, left, doc.y, { width: contentWidth });
    doc.moveDown(0.5);
  }
}

function metadataGrid(doc, items) {
  const gap = 16;
  const columnWidth = (contentWidth - gap) / 2;
  for (let index = 0; index < items.length; index += 2) {
    ensureSpace(doc, 42);
    const row = items.slice(index, index + 2);
    const y = doc.y;
    row.forEach(([label, value], column) => {
      const x = left + column * (columnWidth + gap);
      doc.roundedRect(x, y, columnWidth, 34, 5).fillAndStroke(palette.soft, "#e2e8f0");
      doc.fillColor(palette.muted).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x + 10, y + 6, { width: columnWidth - 20, lineBreak: false });
      doc.fillColor(palette.text).font("Helvetica").fontSize(9).text(clean(value), x + 10, y + 18, { width: columnWidth - 20, lineBreak: false, ellipsis: true });
    });
    doc.y = y + 42;
  }
}

function clinicalBox(doc, label, value) {
  const text = clean(value, "Not documented");
  doc.font("Helvetica").fontSize(9.5);
  const textHeight = doc.heightOfString(text, { width: contentWidth - 28, lineGap: 2 });
  const height = Math.max(52, textHeight + 34);
  ensureSpace(doc, height + 8);
  const y = doc.y;
  doc.roundedRect(left, y, contentWidth, height, 6).fillAndStroke("#ffffff", "#dbe4eb");
  doc.rect(left, y, 5, height).fill(palette.teal);
  doc.fillColor(palette.teal).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), left + 18, y + 12, { characterSpacing: 0.5 });
  doc.fillColor(palette.text).font("Helvetica").fontSize(9.5).text(text, left + 18, y + 29, { width: contentWidth - 32, lineGap: 2 });
  doc.y = y + height + 8;
}

function aiSummaryBox(doc, aiSummary) {
  const summary = clean(aiSummary.text);
  doc.font("Helvetica").fontSize(9.5);
  const summaryHeight = doc.heightOfString(summary, { width: contentWidth - 32, lineGap: 2 });
  const height = Math.max(104, summaryHeight + 68);
  ensureSpace(doc, height + 10);
  const y = doc.y;
  doc.roundedRect(left, y, contentWidth, height, 7).fillAndStroke(palette.violetSoft, "#c4b5fd");
  doc.circle(left + 22, y + 22, 10).fill(palette.violet);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text("AI", left + 14, y + 18, { width: 16, align: "center", lineBreak: false });
  doc.fillColor(palette.violet).font("Helvetica-Bold").fontSize(10).text("CLINICAL SUMMARY (AI-ASSISTED)", left + 40, y + 16, { lineBreak: false });
  doc.fillColor(palette.text).font("Helvetica").fontSize(9.5).text(summary, left + 16, y + 43, { width: contentWidth - 32, lineGap: 2 });
  doc.fillColor(palette.muted).font("Helvetica").fontSize(7.5)
    .text(`Provider: Groq  |  Model: ${clean(aiSummary.model)}  |  Clinician accepted: ${dateTime(aiSummary.acceptedAt)}`, left + 16, y + height - 19, { width: contentWidth - 32, lineBreak: false, ellipsis: true });
  doc.y = y + height + 10;
}

function amendmentsTimeline(doc, amendments) {
  if (!amendments.length) {
    doc.fillColor(palette.muted).font("Helvetica-Oblique").fontSize(9).text("No amendments recorded.", left, doc.y);
    doc.moveDown(0.7);
    return;
  }
  for (const amendment of amendments) {
    const body = clean(amendment.text);
    doc.font("Helvetica").fontSize(9);
    const height = Math.max(58, doc.heightOfString(body, { width: contentWidth - 48, lineGap: 2 }) + 36);
    ensureSpace(doc, height + 8);
    const y = doc.y;
    doc.moveTo(left + 10, y).lineTo(left + 10, y + height).strokeColor("#99f6e4").lineWidth(2).stroke();
    doc.circle(left + 10, y + 10, 5).fill(palette.teal);
    doc.fillColor(palette.text).font("Helvetica").fontSize(9).text(body, left + 28, y, { width: contentWidth - 40, lineGap: 2 });
    doc.fillColor(palette.muted).font("Helvetica").fontSize(7.5).text(`${amendment.actor?.name || "Clinician"} | ${dateTime(amendment.timestamp)}`, left + 28, y + height - 18, { lineBreak: false });
    doc.y = y + height + 8;
  }
}

function carePlans(doc, plans, tasksByPlan) {
  for (const plan of plans) {
    ensureSpace(doc, 104);
    const y = doc.y;
    doc.roundedRect(left, y, contentWidth, 76, 6).fillAndStroke("#f0fdfa", "#99f6e4");
    doc.fillColor(palette.teal).font("Helvetica-Bold").fontSize(10).text(plan.goal, left + 14, y + 12, { width: contentWidth - 28 });
    doc.fillColor(palette.muted).font("Helvetica-Bold").fontSize(7.5).text("TARGET", left + 14, y + 35, { lineBreak: false });
    doc.fillColor(palette.text).font("Helvetica").fontSize(8.5).text(clean(plan.targetMeasure), left + 14, y + 48, { width: 280, lineBreak: false, ellipsis: true });
    doc.fillColor(palette.muted).font("Helvetica-Bold").fontSize(7.5).text("REVIEW CADENCE", left + 330, y + 35, { lineBreak: false });
    doc.fillColor(palette.text).font("Helvetica").fontSize(8.5).text(clean(plan.reviewCadence), left + 330, y + 48, { width: 150, lineBreak: false, ellipsis: true });
    doc.y = y + 86;
    const tasks = tasksByPlan.get(String(plan._id)) || [];
    if (!tasks.length) {
      doc.fillColor(palette.muted).font("Helvetica-Oblique").fontSize(8.5).text("No linked tasks.", left + 14, doc.y);
      doc.moveDown(0.6);
    }
    for (const task of tasks) {
      const outcome = task.outcomeNote ? `Outcome: ${task.outcomeNote}` : "";
      const body = outcome ? `${task.description}\n${outcome}` : task.description;
      doc.font("Helvetica").fontSize(8.5);
      const height = Math.max(42, doc.heightOfString(body, { width: contentWidth - 112, lineGap: 2 }) + 18);
      ensureSpace(doc, height + 6);
      const taskY = doc.y;
      doc.roundedRect(left + 14, taskY, contentWidth - 14, height, 5).fillAndStroke("#ffffff", "#e2e8f0");
      doc.fillColor(palette.text).font("Helvetica").fontSize(8.5).text(body, left + 26, taskY + 10, { width: contentWidth - 126, lineGap: 2 });
      const statusColor = task.status === "completed" ? palette.teal : "#b45309";
      doc.fillColor(statusColor).font("Helvetica-Bold").fontSize(7.5).text(String(task.status).toUpperCase(), left + contentWidth - 80, taskY + 11, { width: 66, align: "right", lineBreak: false });
      doc.y = taskY + height + 6;
    }
    doc.moveDown(0.3);
  }
}

function visitTable(doc, appointments) {
  const columns = [
    { label: "DATE & TIME", x: left, width: 125 },
    { label: "VISIT TYPE", x: left + 125, width: 125 },
    { label: "DOCTOR", x: left + 250, width: 145 },
    { label: "STATUS", x: left + 395, width: 104 },
  ];
  const drawHeader = () => {
    ensureSpace(doc, 34);
    const y = doc.y;
    doc.rect(left, y, contentWidth, 28).fill(palette.navy);
    for (const column of columns) doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5).text(column.label, column.x + 8, y + 10, { width: column.width - 16, lineBreak: false });
    doc.y = y + 28;
  };
  drawHeader();
  appointments.forEach((appointment, index) => {
    if (doc.y + 38 > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (index % 2 === 0) doc.rect(left, y, contentWidth, 38).fill(palette.soft);
    const values = [dateTime(appointment.scheduledAt), clean(appointment.visitType), appointment.doctorId?.name || "Unavailable", String(appointment.status).replace("_", " ")];
    values.forEach((value, columnIndex) => doc.fillColor(columnIndex === 3 ? palette.teal : palette.text).font(columnIndex === 3 ? "Helvetica-Bold" : "Helvetica").fontSize(8).text(value, columns[columnIndex].x + 8, y + 12, { width: columns[columnIndex].width - 16, lineBreak: false, ellipsis: true }));
    doc.moveTo(left, y + 38).lineTo(left + contentWidth, y + 38).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    doc.y = y + 38;
  });
  if (!appointments.length) {
    doc.fillColor(palette.muted).font("Helvetica-Oblique").fontSize(9).text("No appointments recorded.", left + 10, doc.y + 14);
    doc.y += 42;
  }
}

function footer(doc, exportedBy, notice = "") {
  const range = doc.bufferedPageRange();
  const generated = dateTime(new Date());
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const lineY = doc.page.height - 67;
    doc.moveTo(left, lineY).lineTo(left + contentWidth, lineY).strokeColor(palette.border).lineWidth(0.6).stroke();
    if (notice) doc.fillColor(palette.muted).font("Helvetica-Oblique").fontSize(7).text(notice, left, lineY + 8, { width: contentWidth, align: "center", lineBreak: false });
    doc.fillColor(palette.muted).font("Helvetica").fontSize(7.5).text(`Generated ${generated}`, left, doc.page.height - 39, { width: 180, lineBreak: false });
    doc.text(`Exported by ${clean(exportedBy, "Authorized staff")} - Meridian Health Connect`, left + 150, doc.page.height - 39, { width: 270, align: "center", lineBreak: false, ellipsis: true });
    doc.text(`Page ${index + 1} of ${range.count}`, left + 420, doc.page.height - 39, { width: 79, align: "right", lineBreak: false });
    doc.page.margins.bottom = originalBottomMargin;
  }
}

export function renderEncounterPdf(res, { tenant, location, encounter, linkedCarePlans, tasksByPlan, exportedBy }) {
  const doc = createDocument(res, `visit-${encounter._id}.pdf`);
  letterhead(doc, tenant, location, "Finalized Visit Record", encounter.doctorId?.name);
  sectionHeading(doc, "Patient Information");
  metadataGrid(doc, [
    ["Patient name", encounter.patientId.name],
    ["Phone", encounter.patientId.contact?.phone],
    ["Email", encounter.patientId.contact?.email],
    ["Address", encounter.patientId.address],
  ]);
  sectionHeading(doc, "Visit Details");
  metadataGrid(doc, [
    ["Visit date", dateTime(encounter.appointmentId?.scheduledAt)],
    ["Visit type", encounter.appointmentId?.visitType],
    ["Attending physician", encounter.doctorId?.name],
    ["Finalized", dateTime(encounter.finalizedAt)],
  ]);
  sectionHeading(doc, "Clinical Notes", "Clinician-authored documentation reproduced as recorded.");
  clinicalBox(doc, "Symptoms", encounter.notes?.symptoms);
  clinicalBox(doc, "Observations", encounter.notes?.observations);
  clinicalBox(doc, "Diagnosis", encounter.notes?.diagnosis);
  if (encounter.aiSummary?.text) {
    sectionHeading(doc, "AI-Assisted Summary");
    aiSummaryBox(doc, encounter.aiSummary);
  }
  if (encounter.amendments?.length) {
    sectionHeading(doc, "Amendments");
    amendmentsTimeline(doc, encounter.amendments);
  }
  if (linkedCarePlans.length) {
    sectionHeading(doc, "Related Care Plan & Tasks");
    carePlans(doc, linkedCarePlans, tasksByPlan);
  }
  footer(doc, exportedBy);
  doc.end();
}

export function renderVisitHistoryPdf(res, { tenant, location, patient, appointments, exportedBy }) {
  const doc = createDocument(res, `visit-history-${patient._id}.pdf`);
  letterhead(doc, tenant, location, "Administrative Visit History");
  sectionHeading(doc, "Patient Information");
  metadataGrid(doc, [
    ["Patient name", patient.name],
    ["Phone", patient.contact?.phone],
    ["Email", patient.contact?.email],
    ["Address", patient.address],
  ]);
  sectionHeading(doc, "Complete Visit History", "Administrative scheduling history; clinical detail is intentionally excluded.");
  visitTable(doc, appointments);
  footer(doc, exportedBy, "Administrative export only - clinical notes, diagnoses, care-plan details, and task outcomes are excluded.");
  doc.end();
}
