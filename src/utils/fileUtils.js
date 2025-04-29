export const generateUniqueName = (originalName, existingNames) => {
  const getExtension = (filename) => {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.slice(lastDotIndex) : '';
  };

  const getBaseName = (filename, ext) => {
    return filename.slice(0, filename.length - ext.length);
  };

  const ext = getExtension(originalName);
  const baseName = getBaseName(originalName, ext);
  let newName = originalName;
  let counter = 1;

  while (existingNames.includes(newName)) {
    newName = `${baseName} (${counter})${ext}`;
    counter++;
  }

  return newName;
};