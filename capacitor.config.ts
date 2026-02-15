import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lyriacamera.app",
  appName: "Lyria Camera",
  webDir: "dist",
  ios: {
    allowsLinkPreview: false,
    contentInset: "always",
  },
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
};

export default config;
