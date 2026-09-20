const path = require('path');

const GUIDE_FILES = Object.freeze({
  pdf: 'HUONG-DAN-SU-DUNG-CTGDMN-0.6.0.pdf',
  docx: 'HUONG-DAN-SU-DUNG-CTGDMN-0.6.0.docx',
});

function resolveGuidePath(root, format) {
  const filename = GUIDE_FILES[format];
  if (!filename) throw new Error('Định dạng tài liệu hướng dẫn không hợp lệ.');

  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, filename);
  if (!candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Đường dẫn tài liệu hướng dẫn không an toàn.');
  }
  return candidate;
}

module.exports = { GUIDE_FILES, resolveGuidePath };
