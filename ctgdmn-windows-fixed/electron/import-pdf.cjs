const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { safeImportName } = require('./validation.cjs');

async function uniqueDestination(root, filename) {
  const safe = safeImportName(filename);
  const extension = path.extname(safe);
  const stem = path.basename(safe, extension);
  let candidate = path.join(root, safe);
  let number = 2;
  while (fs.existsSync(candidate)) { candidate = path.join(root, `${stem}-${number}${extension}`); number += 1; }
  return candidate;
}

async function importPdfFiles(files, destinationRoot, actor = '') {
  await fs.promises.mkdir(destinationRoot, { recursive: true });
  const imported = [];
  for (const file of files) {
    const destination = await uniqueDestination(destinationRoot, file.name);
    await fs.promises.copyFile(file.path, destination, fs.constants.COPYFILE_EXCL);
    const stat = await fs.promises.stat(destination);
    imported.push({ id: `source-${crypto.randomUUID()}`, filename: path.basename(destination), relativePath: path.relative(destinationRoot, destination).split(path.sep).join('/'), documentType: 'PDF nguồn bổ sung', pageCount: null, importedAt: new Date().toISOString(), importedBy: String(actor || '').trim(), reviewStatus: 'Mới nhập – cần rà soát', size: stat.size });
  }
  return imported;
}

module.exports = { importPdfFiles, uniqueDestination };
