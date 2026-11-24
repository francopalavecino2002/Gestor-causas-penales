/**
 * Hands a downloaded file to the browser under the given name: a temporary object URL and a
 * hidden `<a download>`, both released right after the click.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Some browsers read the URL after the click returns: release it on the next task.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
