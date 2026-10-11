// Sinh tệp Word bằng bản Node để đối chiếu nội dung với bản Python (chạy: node node_export.cjs <thư mục ra>).
const fs = require('fs');
const path = require('path');
const { createPlanDocx } = require('../../../ctgdmn-windows-fixed/electron/export-word.cjs');
const fixture = require('./plans.json');
(async () => {
  const out = process.argv[2];
  for (const plan of fixture.plans) fs.writeFileSync(path.join(out, `${plan.id}.docx`), await createPlanDocx(plan, fixture.school));
})();
