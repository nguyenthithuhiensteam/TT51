const TRUSTED_RESOURCES = Object.freeze({
  'preschool-teacher-assistant': 'https://chatgpt.com/g/g-68456c84ef908191876388962d011561-co-giao-mam-non',
});

function trustedResourceUrl(resourceId) {
  const url = TRUSTED_RESOURCES[resourceId];
  if (!url) throw new Error('Nguồn trực tuyến không nằm trong danh sách được phép.');
  return url;
}

module.exports = { TRUSTED_RESOURCES, trustedResourceUrl };
