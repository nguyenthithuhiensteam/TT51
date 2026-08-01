// TỰ ĐỘNG SINH — phân hệ "partyRepo" chưa được chuyển sang Firestore trên bản web.
// Các hàm dưới đây chỉ để bản build không lỗi thiếu import; gọi tới sẽ báo lỗi rõ ràng.
function notImplemented(name: string): never {
  throw new Error(`${name}: phân hệ "partyRepo" chưa hỗ trợ trên bản web (đang được xây dựng).`);
}

export async function listPartyMembers(..._args: unknown[]): Promise<never> {
  return notImplemented("listPartyMembers");
}

export async function getPartyMemberByUserId(..._args: unknown[]): Promise<never> {
  return notImplemented("getPartyMemberByUserId");
}

export async function createPartyMember(..._args: unknown[]): Promise<never> {
  return notImplemented("createPartyMember");
}

export async function listPartyMeetings(..._args: unknown[]): Promise<never> {
  return notImplemented("listPartyMeetings");
}

export async function getPartyMeetingById(..._args: unknown[]): Promise<never> {
  return notImplemented("getPartyMeetingById");
}

export async function createPartyMeeting(..._args: unknown[]): Promise<never> {
  return notImplemented("createPartyMeeting");
}

export async function changePartyMeetingStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changePartyMeetingStatus");
}

export async function getPartyMeetingMinutes(..._args: unknown[]): Promise<never> {
  return notImplemented("getPartyMeetingMinutes");
}

export async function savePartyMeetingMinutes(..._args: unknown[]): Promise<never> {
  return notImplemented("savePartyMeetingMinutes");
}

export async function listResolutions(..._args: unknown[]): Promise<never> {
  return notImplemented("listResolutions");
}

export async function createResolution(..._args: unknown[]): Promise<never> {
  return notImplemented("createResolution");
}

export async function changeResolutionStatus(..._args: unknown[]): Promise<never> {
  return notImplemented("changeResolutionStatus");
}

export async function listResolutionTracking(..._args: unknown[]): Promise<never> {
  return notImplemented("listResolutionTracking");
}

export async function addResolutionTracking(..._args: unknown[]): Promise<never> {
  return notImplemented("addResolutionTracking");
}

export async function getMemberEvaluation(..._args: unknown[]): Promise<never> {
  return notImplemented("getMemberEvaluation");
}

export async function upsertMemberEvaluation(..._args: unknown[]): Promise<never> {
  return notImplemented("upsertMemberEvaluation");
}

export async function listPartyFees(..._args: unknown[]): Promise<never> {
  return notImplemented("listPartyFees");
}

export async function recordPartyFeePayment(..._args: unknown[]): Promise<never> {
  return notImplemented("recordPartyFeePayment");
}
