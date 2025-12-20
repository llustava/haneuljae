import type { Metadata } from "next";
import { headers } from "next/headers";
import MobileDetect from "mobile-detect";
import DeviceDetectPanel from "@/components/device-detect-panel";

export const metadata: Metadata = {
  title: "Use Detect",
  description: "Server and client coordinated device detection demo",
};

export default function DetectPage() {
  const userAgent = headers().get("user-agent") ?? "";
  const detector = new MobileDetect(userAgent);
  const isMobile = Boolean(detector.mobile());

  return <DeviceDetectPanel initialIsMobile={isMobile} userAgent={userAgent} />;
}
