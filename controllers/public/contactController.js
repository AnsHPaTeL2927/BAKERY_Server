const prisma = require('../../config/prisma');
const { asyncHandler } = require('../../middleware/errorHandler');

const create = asyncHandler(async (req, res) => {
  const message = await prisma.contactMessage.create({ data: req.body });
  res.status(201).json({ ok: true, id: message.id });
});

module.exports = { create };
