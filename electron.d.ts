interface ElectronAPI {
  saveWebDAVConfig: (config: WebDAVConfig) => Promise<{ success: boolean; error?: string }>;
  getWebDAVConfig: () => Promise<WebDAVConfig | null>;
  testWebDAVConnection: (config: WebDAVConfig) => Promise<{ success: boolean; error?: string }>;
  
  // 窗口控制相关 API
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
  isWindowMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (maximized: boolean) => void) => void;
  removeMaximizeListener: () => void;
}

interface WebDAVConfig {
  protocol: string;
  server: string;
  port: string;
  path: string;
  username: string;
  password: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 