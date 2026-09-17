import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env, validateRuntimeEnv } from "../config/env.js";
import { Location } from "../models/Location.js";
import { Tenant } from "../models/Tenant.js";
import { User } from "../models/User.js";
import { FormTemplate } from "../models/FormTemplate.js";
import { hashPassword } from "../services/passwordService.js";

const tenants = [
  {
    name: "City Care Clinic",
    slug: "city-care",
    admin: { name: "Amina Khan", email: "admin@citycare.test" },
    locations: [
      {
        name: "Gulberg Branch",
        slug: "gulberg",
        address: "Main Boulevard, Gulberg",
        legacyNames: ["Downtown Clinic"],
      },
      {
        name: "DHA Branch",
        slug: "dha",
        address: "Commercial Avenue, DHA",
        legacyNames: ["North Clinic"],
      },
    ],
  },
  {
    name: "Green Valley Health",
    slug: "green-valley",
    admin: { name: "Daniel Brooks", email: "admin@greenvalley.test" },
    locations: [
      {
        name: "Johar Town Branch",
        slug: "johar-town",
        address: "Main Boulevard, Johar Town",
        legacyNames: ["Main Clinic"],
      },
      {
        name: "Bahria Branch",
        slug: "bahria",
        address: "Central Avenue, Bahria Town",
        legacyNames: [],
      },
    ],
  },
];

async function seed() {
  validateRuntimeEnv();
  await connectDatabase();
  const passwordHash = await hashPassword(env.seedAdminPassword);

  for (const item of tenants) {
    const tenant = await Tenant.findOneAndUpdate(
      { slug: item.slug },
      { $set: { name: item.name } },
      { upsert: true, new: true, runValidators: true },
    );

    const seededLocations = [];
    for (const location of item.locations) {
      const seededLocation = await Location.findOneAndUpdate(
        {
          tenantId: tenant._id,
          $or: [
            { slug: location.slug },
            { name: { $in: location.legacyNames } },
          ],
        },
        { $set: { name: location.name, slug: location.slug, address: location.address } },
        { upsert: true, new: true, runValidators: true },
      );
      seededLocations.push(seededLocation);
    }

    await User.findOneAndUpdate(
      { tenantId: tenant._id, email: item.admin.email },
      { $set: { ...item.admin, passwordHash, role: "admin", isActive: true }, $unset: { locationId: "" } },
      { upsert: true, new: true, runValidators: true },
    );

    await User.updateMany(
      {
        tenantId: tenant._id,
        role: { $ne: "admin" },
        locationId: { $exists: false },
      },
      { $set: { locationId: seededLocations[0]._id } },
    );

    if (item.slug === "city-care") {
      const gulberg = seededLocations.find((location) => location.slug === "gulberg");
      const admin = await User.findOne({ tenantId: tenant._id, email: item.admin.email }).select("_id").lean();
      const templates = [
        { name: "General Treatment Consent", fields: [
          { id: "treatment-statement", type: "static_text", label: "I understand that City Care Clinic staff will examine, diagnose, and provide necessary treatment based on my symptoms.", required: false },
          { id: "treatment-agreement", type: "checkbox", label: "I have read and understood the above statement, and consent to treatment.", required: true },
          { id: "drug-allergies", type: "short_text", label: "Do you have any known drug allergies?", required: false },
          { id: "emergency-contact-sharing", type: "yes_no", label: "Do you consent to sharing treatment information with your emergency contact?", required: false },
          { id: "patient-signature", type: "signature", label: "Patient signature", required: true },
        ] },
        { name: "Telehealth Consent", fields: [
          { id: "telehealth-statement", type: "static_text", label: "I understand this visit will be conducted via video/audio call rather than in person, and that some limitations apply to remote examination.", required: false },
          { id: "telehealth-agreement", type: "checkbox", label: "I consent to a telehealth visit under these conditions.", required: true },
          { id: "patient-signature", type: "signature", label: "Patient signature", required: true },
        ] },
        { name: "Photography/Media Consent", fields: [
          { id: "photography-statement", type: "static_text", label: "City Care Clinic may take photographs for clinical documentation purposes (e.g. wound progress tracking).", required: false },
          { id: "photography-agreement", type: "checkbox", label: "I consent to clinical photography being taken and stored as part of my medical record.", required: true },
          { id: "training-use", type: "yes_no", label: "May this be used for staff training purposes (fully anonymized)?", required: false },
          { id: "patient-signature", type: "signature", label: "Patient signature", required: true },
        ] },
      ];
      for (const template of templates) {
        await FormTemplate.findOneAndUpdate(
          { tenantId: tenant._id, locationId: gulberg._id, name: template.name },
          { $set: { fields: template.fields }, $setOnInsert: { createdBy: admin._id } },
          { upsert: true, new: true, runValidators: true },
        );
      }
    }
  }

  console.log("Seed complete");
  console.log(`City Care: admin@citycare.test / ${env.seedAdminPassword}`);
  console.log(`Green Valley: admin@greenvalley.test / ${env.seedAdminPassword}`);
}

seed()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
