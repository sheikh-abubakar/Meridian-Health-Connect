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
      { name: "Downtown Clinic", address: "100 Central Avenue, Austin, TX" },
      { name: "North Clinic", address: "2400 North Loop, Austin, TX" },
    ],
  },
  {
    name: "Green Valley Health",
    slug: "green-valley",
    admin: { name: "Daniel Brooks", email: "admin@greenvalley.test" },
    locations: [{ name: "Main Clinic", address: "45 Valley Road, Denver, CO" }],
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

    for (const location of item.locations) {
      await Location.findOneAndUpdate(
        { tenantId: tenant._id, name: location.name },
        { $set: { address: location.address } },
        { upsert: true, new: true, runValidators: true },
      );
    }

    await User.findOneAndUpdate(
      { tenantId: tenant._id, email: item.admin.email },
      { $set: { ...item.admin, passwordHash, role: "admin" } },
      { upsert: true, new: true, runValidators: true },
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
