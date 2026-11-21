import { prisma } from "./prisma";

export async function getAppSettings() {
  let settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.appSettings.create({
      data: {
        id: "default",
        timezone: "UTC",
        reminderSound: true,
        largeText: false,
      },
    });
  }

  return settings;
}

export async function updateAppSettings(data: {
  timezone?: string;
  reminderSound?: boolean;
  largeText?: boolean;
}) {
  return await prisma.appSettings.upsert({
    where: { id: "default" },
    update: data,
    create: {
      id: "default",
      timezone: data.timezone || "UTC",
      reminderSound: data.reminderSound ?? true,
      largeText: data.largeText ?? false,
    },
  });
}
