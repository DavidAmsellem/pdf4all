const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  savePDF: (fileData) => ipcRenderer.invoke('save-pdf', fileData),
  getPDFs: () => ipcRenderer.invoke('get-pdfs'),
  openPDF: (fileName) => ipcRenderer.invoke('open-pdf', fileName),
  deletePDF: (fileName) => ipcRenderer.invoke('delete-pdf', fileName),
  renamePDF: (oldName, newName) => ipcRenderer.invoke('rename-pdf', oldName, newName),
  closeApp: () => ipcRenderer.invoke('close-app'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window')
});