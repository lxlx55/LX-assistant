const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lxAPI', {
  // AI Chat
  chat: (data) => ipcRenderer.invoke('lx:chat', data),
  
  // Speech-to-Text (send audio buffer)
  transcribe: (buffer) => ipcRenderer.invoke('lx:transcribe', buffer),
  
  // Text-to-Speech (returns base64 audio)
  speak: (text) => ipcRenderer.invoke('lx:speak', text),
  
  // System Status
  getStatus: () => ipcRenderer.invoke('lx:status'),
  
  // Phase 4: Memory
  getHistory: (limit) => ipcRenderer.invoke('lx:getHistory', limit),
  clearHistory: () => ipcRenderer.invoke('lx:clearHistory'),
  getStats: () => ipcRenderer.invoke('lx:getStats'),

  // Phase 5: Tools
  search: (query) => ipcRenderer.invoke('lx:search', query),
  getSystemInfo: () => ipcRenderer.invoke('lx:systemInfo')
});
