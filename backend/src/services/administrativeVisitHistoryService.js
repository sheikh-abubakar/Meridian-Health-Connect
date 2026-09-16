import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import { ApiError } from "../utils/ApiError.js";

// This is deliberately limited to administrative appointment history. Do not
// add Encounter, CarePlan, or Task data here: the same export is used by
// Front-desk and by the patient's portal.
export async function getAdministrativeVisitHistory({
  tenantId,
  locationId,
  patientId,
}) {
  const match = { tenantId, locationId };
  const patient = await Patient.findOne({ _id: patientId, ...match })
    .select("name contact address")
    .lean();
  if (!patient) throw new ApiError(404, "Patient not found in this location");

  const appointments = await Appointment.find({
    patientId: patient._id,
    ...match,
  })
    .select("scheduledAt visitType doctorId status")
    .populate({ path: "doctorId", select: "name", match })
    .sort({ scheduledAt: -1 })
    .lean();

  return { patient, appointments };
}
