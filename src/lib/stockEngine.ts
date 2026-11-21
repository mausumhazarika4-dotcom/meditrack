import { prisma } from "./prisma";

export async function markDoseTaken(doseId: string, customTakenAt?: Date) {
  return await prisma.$transaction(async (tx) => {
    const dose = await tx.scheduledDose.findUnique({
      where: { id: doseId },
      include: { medication: true },
    });

    if (!dose) {
      throw new Error(`Dose with ID ${doseId} not found`);
    }

    // Idempotent: If already taken, do nothing to stock or status
    if (dose.status === "TAKEN") {
      return dose;
    }

    const takenAt = customTakenAt || new Date();

    // Update dose status
    const updatedDose = await tx.scheduledDose.update({
      where: { id: doseId },
      data: {
        status: "TAKEN",
        takenAt,
        snoozedUntil: null,
      },
    });

    // Check if medication has stock tracking enabled
    if (dose.medication.stockTracking && dose.medication.stock !== null) {
      const currentStock = dose.medication.stock;
      const newStock = Math.max(0, currentStock - 1);

      await tx.medication.update({
        where: { id: dose.medicationId },
        data: { stock: newStock },
      });

      await tx.stockAdjustment.create({
        data: {
          medicationId: dose.medicationId,
          doseId: dose.id,
          amount: -1,
          balanceAfter: newStock,
          reason: "DOSE_TAKEN",
        },
      });
    }

    return updatedDose;
  });
}

export async function markDoseSkipped(doseId: string) {
  return await prisma.$transaction(async (tx) => {
    const dose = await tx.scheduledDose.findUnique({
      where: { id: doseId },
      include: { medication: true },
    });

    if (!dose) {
      throw new Error(`Dose with ID ${doseId} not found`);
    }

    // If already skipped, do nothing
    if (dose.status === "SKIPPED") {
      return dose;
    }

    // If it was TAKEN previously and user switches to SKIPPED, restore the stock!
    if (dose.status === "TAKEN" && dose.medication.stockTracking && dose.medication.stock !== null) {
      const newStock = dose.medication.stock + 1;
      await tx.medication.update({
        where: { id: dose.medicationId },
        data: { stock: newStock },
      });

      await tx.stockAdjustment.create({
        data: {
          medicationId: dose.medicationId,
          doseId: dose.id,
          amount: 1,
          balanceAfter: newStock,
          reason: "UNDO_TAKEN",
        },
      });
    }

    // Skipping a dose does not reduce stock
    return await tx.scheduledDose.update({
      where: { id: doseId },
      data: {
        status: "SKIPPED",
        takenAt: null,
        snoozedUntil: null,
      },
    });
  });
}

export async function undoDoseAction(doseId: string) {
  return await prisma.$transaction(async (tx) => {
    const dose = await tx.scheduledDose.findUnique({
      where: { id: doseId },
      include: { medication: true },
    });

    if (!dose) {
      throw new Error(`Dose with ID ${doseId} not found`);
    }

    // Idempotent: If it's already SCHEDULED, do nothing
    if (dose.status === "SCHEDULED") {
      return dose;
    }

    const previousStatus = dose.status;

    // Reset status back to SCHEDULED
    const updatedDose = await tx.scheduledDose.update({
      where: { id: doseId },
      data: {
        status: "SCHEDULED",
        takenAt: null,
        snoozedUntil: null,
      },
    });

    // If it was TAKEN, restore stock by 1
    if (previousStatus === "TAKEN" && dose.medication.stockTracking && dose.medication.stock !== null) {
      const newStock = dose.medication.stock + 1;

      await tx.medication.update({
        where: { id: dose.medicationId },
        data: { stock: newStock },
      });

      await tx.stockAdjustment.create({
        data: {
          medicationId: dose.medicationId,
          doseId: dose.id,
          amount: 1,
          balanceAfter: newStock,
          reason: "UNDO_TAKEN",
        },
      });
    }

    return updatedDose;
  });
}

export async function snoozeDose(doseId: string, minutes: number = 10) {
  const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);

  return await prisma.scheduledDose.update({
    where: { id: doseId },
    data: {
      snoozedUntil: snoozeUntil,
    },
  });
}

export async function refillStock(medicationId: string, quantityToAdd: number) {
  if (quantityToAdd <= 0 || !Number.isInteger(quantityToAdd)) {
    throw new Error("Refill quantity must be a positive integer");
  }

  return await prisma.$transaction(async (tx) => {
    const med = await tx.medication.findUnique({
      where: { id: medicationId },
    });

    if (!med) {
      throw new Error(`Medication with ID ${medicationId} not found`);
    }

    const currentStock = med.stock ?? 0;
    const newStock = currentStock + quantityToAdd;

    const updatedMed = await tx.medication.update({
      where: { id: medicationId },
      data: {
        stock: newStock,
        stockTracking: true,
      },
    });

    await tx.stockAdjustment.create({
      data: {
        medicationId,
        amount: quantityToAdd,
        balanceAfter: newStock,
        reason: "REFILL",
      },
    });

    return updatedMed;
  });
}
