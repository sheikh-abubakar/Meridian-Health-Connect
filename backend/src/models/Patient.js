import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: true, index: true },
    name: { type: String, required: true, trim: true },
    contact: {
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    address: { type: String, required: true, trim: true },
    insuranceInfo: {
      provider: { type: String, trim: true },
      policyNumber: { type: String, trim: true },
    },
    communicationPreferences: {
      smsOptOut: { type: Boolean, default: false },
      emailOptOut: { type: Boolean, default: false },
      voiceOptOut: { type: Boolean, default: false },
    },
    relatedParties: [{
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
      relationship: { type: String, enum: ["guardian", "caregiver", "guarantor", "emergency_contact"], required: true },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      addedAt: { type: Date, default: Date.now },
    }],
    householdMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Patient" }],
    householdRelationships: [{
      patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
      relationship: { type: String, enum: ["mother", "father", "brother", "sister", "other"], required: true },
    }],
    editHistory: [{
      field: { type: String, enum: ["name", "phone", "email", "address", "insuranceProvider", "policyNumber"], required: true },
      oldValue: { type: String, default: "" },
      newValue: { type: String, default: "" },
      editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      editedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

patientSchema.index({ tenantId: 1, locationId: 1, createdAt: -1 });
patientSchema.index({ tenantId: 1, locationId: 1, "contact.phone": 1 });
patientSchema.index({ tenantId: 1, locationId: 1, name: 1 });
patientSchema.index({ tenantId: 1, locationId: 1, householdMembers: 1 });

export const Patient = mongoose.model("Patient", patientSchema);
