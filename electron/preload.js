const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // WebDAV配置相关
  saveWebDAVConfig: (config) => ipcRenderer.invoke('save-webdav-config', config),
  getWebDAVConfig: () => ipcRenderer.invoke('get-webdav-config'),
  testWebDAVConnection: (config) => ipcRenderer.invoke('test-webdav-connection', config),
  
  // 窗口控制相关
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window-maximize-change', (_, maximized) => callback(maximized));
  },
  removeMaximizeListener: () => {
    ipcRenderer.removeAllListeners('window-maximize-change');
  }
}); 