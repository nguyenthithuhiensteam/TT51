const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = Number(process.env.PORT || 8765);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon', '.svg':'image/svg+xml', '.pdf':'application/pdf' };
http.createServer((req,res)=>{
  const requested = decodeURIComponent((req.url || '/src/index.html').split('?')[0]);
  const relative = requested === '/' ? '/src/index.html' : requested;
  const file = path.resolve(root, `.${relative}`);
  if (!file.startsWith(`${root}${path.sep}`)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file,(error,stat)=>{
    if(error || !stat.isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  });
}).listen(port,'127.0.0.1',()=>console.log(`CTGDMN preview: http://127.0.0.1:${port}/src/index.html`));
