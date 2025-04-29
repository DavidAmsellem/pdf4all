const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  savePDF: (fileData) => ipcRenderer.invoke('save-pdf', fileData),
  getPDFs: () => ipcRenderer.invoke('get-pdfs'),
  openPDF: (fileName) => ipcRenderer.invoke('open-pdf', fileName),
  deletePDF: (fileName) => ipcRenderer.invoke('delete-pdf', fileName)
});