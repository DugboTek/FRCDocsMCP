export enum Library {
  WPILib = "WPILib",
  CTREPhoenix6 = "CTRE Phoenix 6",
  AdvantageKit = "AdvantageKit",
  REVRobotics = "REV Robotics",
  Limelight = "Limelight",
}

export const BASE_URLS: Record<Library, string> = {
  [Library.WPILib]: "https://docs.wpilib.org/en/stable",
  [Library.CTREPhoenix6]: "https://v6.docs.ctr-electronics.com/en/stable",
  [Library.AdvantageKit]: "https://docs.advantagekit.org",
  [Library.REVRobotics]: "https://docs.revrobotics.com",
  [Library.Limelight]: "https://docs.limelightvision.io",
};

export const BATCH_SIZE = 10;
export const BATCH_DELAY_MS = 5000;
export const GEMINI_MODEL = "gemini-3-flash-preview";
