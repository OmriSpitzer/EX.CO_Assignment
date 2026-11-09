/// <reference types="vite/client" />

interface AppBoot {
  message: string;
  version: string;
  podName: string;
}

interface Window {
  __BOOT__?: AppBoot;
}
