import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env, validateRuntimeEnv } from "../config/env.js";
import { Location } from "../models/Location.js";
import { Tenant } from "../models/Tenant.js";
import { User } from "../models/User.js";
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
