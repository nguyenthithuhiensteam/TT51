const crypto = require('crypto');

const ROLES = Object.freeze({ ADMIN:'system_admin', PRINCIPAL:'principal', VICE:'vice_principal', LEAD:'team_lead', TEACHER:'teacher', VIEWER:'viewer' });
const ROLE_LABELS = Object.freeze({ system_admin:'Quản trị hệ thống', principal:'Hiệu trưởng/người phê duyệt', vice_principal:'Phó hiệu trưởng phụ trách chuyên môn', team_lead:'Tổ trưởng chuyên môn', teacher:'Giáo viên', viewer:'Người xem' });
const PERMISSIONS = Object.freeze({
  system_admin:['accounts.manage','school.configure','backup.manage','video.manage','audit.view','data.manage','data.read','assessment.manage'],
  principal:['plan.read','plan.review','plan.approve','report.read','signature.use','document.export','data.read','assessment.manage'],
  vice_principal:['plan.read','plan.review','plan.submit_approval','plan.approve_configured','report.read','document.export','data.read','assessment.manage'],
  team_lead:['plan.read','plan.review','plan.request_changes','plan.submit_professional','data.read','assessment.manage'],
  teacher:['plan.read','plan.create','plan.edit','plan.submit_team','review.respond','data.read','document.export_own','assessment.manage'],
  viewer:['plan.read_shared','data.read_shared','video.view'],
});

function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');
  const salt=crypto.randomBytes(16); const hash=crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1});
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(password,encoded='') {
  try { const [name,n,r,p,salt,expected]=encoded.split('$');if(name!=='scrypt')return false;const actual=crypto.scryptSync(String(password),Buffer.from(salt,'base64'),Buffer.from(expected,'base64').length,{N:Number(n),r:Number(r),p:Number(p)});return crypto.timingSafeEqual(actual,Buffer.from(expected,'base64')); } catch{return false;}
}
function permissionsFor(user={}) { const permissions=new Set((user.roles||[]).flatMap((role)=>PERMISSIONS[role]||[]));if((user.roles||[]).length)permissions.add('video.view');return permissions; }
function hasPermission(user,action){return permissionsFor(user).has(action);}
function scopeAllows(user={},resource={}) {
  const roles=user.roles||[]; if(roles.includes(ROLES.PRINCIPAL))return true;
  if(roles.includes(ROLES.VICE))return (!user.scopeCampus||user.scopeCampus===resource.campus)&&(!user.scopeTeam||user.scopeTeam===resource.team)&&(!(user.scopeClassIds||[]).length||(user.scopeClassIds||[]).includes(resource.classId));
  if(roles.includes(ROLES.LEAD))return Boolean(user.team)&&user.team===resource.team;
  if(roles.includes(ROLES.TEACHER))return resource.authorTeacherId===user.staffId||(user.classIds||[]).includes(resource.classId);
  if(roles.includes(ROLES.VIEWER))return resource.shared===true;
  return false;
}
function authorize(user,action,resource={}) {
  if(!user||user.active===false)throw new Error('Tài khoản không hoạt động.');
  if(!hasPermission(user,action))throw new Error('Bạn không có quyền thực hiện thao tác này.');
  if(action==='plan.create'&&resource.authorTeacherId!==user.staffId)throw new Error('Giáo viên chỉ được tạo kế hoạch của chính mình.');
  if(action.startsWith('plan.')&&!['plan.create'].includes(action)&&!scopeAllows(user,resource))throw new Error('Dữ liệu nằm ngoài phạm vi được phân công.');
  if(action==='plan.approve'&&resource.authorTeacherId===user.staffId)throw new Error('Người soạn không được tự phê duyệt kế hoạch của mình.');
  if(action==='signature.use'&&resource.ownerStaffId&&resource.ownerStaffId!==user.staffId&&!user.roles.includes(ROLES.PRINCIPAL))throw new Error('Không được sử dụng chữ ký của người khác.');
  return true;
}
const TRANSITIONS=Object.freeze({ draft:{sent_team:'plan.submit_team'}, sent_team:{changes_requested:'plan.request_changes',sent_professional:'plan.submit_professional'}, changes_requested:{draft:'plan.edit'}, sent_professional:{submitted_approval:'plan.submit_approval'}, submitted_approval:{approved:'plan.approve',changes_requested:'plan.review'}, approved:{draft:'plan.edit'} });
function transitionPlan(user,plan,toStatus){const action=TRANSITIONS[plan.workflowStatus||'draft']?.[toStatus];if(!action)throw new Error('Chuyển trạng thái kế hoạch không hợp lệ.');authorize(user,action,plan);if((plan.workflowStatus==='sent_team'||plan.workflowStatus==='sent_professional'||plan.workflowStatus==='submitted_approval')&&action==='plan.edit')throw new Error('Bản kế hoạch đang gửi đã bị khóa.');return {...plan,workflowStatus:toStatus,version:plan.workflowStatus==='approved'&&toStatus==='draft'?(Number(plan.version)||1)+1:Number(plan.version)||1};}
function safeHttpsUrl(value=''){try{const url=new URL(value);return url.protocol==='https:'&&Boolean(url.hostname);}catch{return false;}}
function videoAvailability(video={},online=true){return video.enabled===false?'disabled':video.sourceType==='online'&&!online?'needs-internet':'available';}
function sanitizeAuditDetails(details={}){const safe={};for(const [key,value] of Object.entries(details||{})){if(/pass(word)?|secret|token|hash/i.test(key))continue;safe[key]=typeof value==='string'&&value.length>500?`${value.slice(0,500)}…`:value;}return safe;}
function validateVideoFile(filename='',size=0,mimeType='video/mp4') {
  const extension=String(filename).toLowerCase().endsWith('.mp4');
  const mime=String(mimeType).toLowerCase()==='video/mp4';
  const validSize=Number.isFinite(Number(size))&&Number(size)>0&&Number(size)<=1024*1024*1024;
  return {valid:extension&&mime&&validSize,extension,mime,validSize};
}
module.exports={ROLES,ROLE_LABELS,PERMISSIONS,hashPassword,verifyPassword,permissionsFor,hasPermission,scopeAllows,authorize,transitionPlan,safeHttpsUrl,videoAvailability,validateVideoFile,sanitizeAuditDetails};
