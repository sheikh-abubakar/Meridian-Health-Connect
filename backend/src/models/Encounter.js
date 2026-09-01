import mongoose from "mongoose";

const amendmentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Date, default: Date.now, immutable: true },
  },
  { _id: true },
);

const encounterSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notes: {
      symptoms: { type: String, default: "", trim: true },
      observations: { type: String, default: "", trim: true },
      diagnosis: { type: String, default: "", trim: true },
    },
    aiSummary: {
      text: { type: String, trim: true, maxlength: 10000 },
      generatedAt: { type: Date },
      model: { type: String, trim: true },
      acceptedAt: { type: Date },
    },
    status: { type: String, enum: ["draft", "finalized"], default: "draft" },
    finalizedAt: { type: Date },
    amendments: { type: [amendmentSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

encounterSchema.index(
  { tenantId: 1, locationId: 1, appointmentId: 1 },
  { unique: true },
);
encounterSchema.index({ tenantId: 1, locationId: 1, patientId: 1, createdAt: -1 });

encounterSchema.pre("save", async function preventFinalizedClinicalMutation() {
  if (this.isNew || (!this.isModified("notes") && !this.isModified("aiSummary"))) return;
  const persisted = await this.constructor.findOne({
    _id: this._id,
    tenantId: this.tenantId,
    locationId: this.locationId,
  }).select("status").lean();
  if (persisted?.status === "finalized") {
    const error = new Error("Finalized encounter notes and AI-assisted summary are immutable; add an amendment instead");
    error.statusCode = 409;
    throw error;
  }
});

export const Encounter = mongoose.model("Encounter", encounterSchema);
