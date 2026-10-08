if (!process.env.CSC_LINK) {
  console.error('Set CSC_LINK to a trusted Windows code-signing certificate before creating a signed installer.');
  process.exitCode = 1;
} else {
  console.log('Code-signing certificate configured; electron-builder will sign the Windows installer.');
}
