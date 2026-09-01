export function mockEligibilityCheck(patient) {
  const hasCompleteInsurance = Boolean(
    patient.insuranceInfo?.provider?.trim()
    && patient.insuranceInfo?.policyNumber?.trim(),
  );
  return hasCompleteInsurance ? "verified" : "pending";
}

