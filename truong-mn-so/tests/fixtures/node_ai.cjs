// Đối chiếu với bản Node:
//   node node_ai.cjs prompt <action> <plan.json>
//   node node_ai.cjs decrypt <khóa b64> <dữ liệu b64>
//   node node_ai.cjs encrypt <khóa b64> <chuỗi>
const fs = require('fs');
const { buildPrompt } = require('../../../ctgdmn-windows-fixed/electron/ai-service.cjs');
(async () => {
  const { ServerSafeStorage } = await import('../../../ctgdmn-windows-fixed/server/crypto-store.mjs');
  const [command, a, b] = process.argv.slice(2);
  if (command === 'prompt') process.stdout.write(JSON.stringify(buildPrompt(a, JSON.parse(fs.readFileSync(b, 'utf8')))));
  if (command === 'decrypt') process.stdout.write(new ServerSafeStorage(a).decryptString(Buffer.from(b, 'base64')));
  if (command === 'encrypt') process.stdout.write(new ServerSafeStorage(a).encryptString(b).toString('base64'));
})();
