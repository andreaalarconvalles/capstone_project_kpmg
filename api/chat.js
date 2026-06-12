module.exports = async function handler(req, res) {
  const { default: nestedHandler } = await import("../Stage 7 - UI Interface/vercel_vite_app/api/chat.js");
  return nestedHandler(req, res);
};
