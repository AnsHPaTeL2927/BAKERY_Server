const prisma = require('../config/prisma');

// Persists a new drag-and-drop order: `ids` is the (possibly paginated) list of
// record ids in their new visual order. `offset` is the absolute position of the
// first id (e.g. (page - 1) * pageSize), so reordering within one page never
// collides with the sort values of records sitting on a different page.
async function applyOrder(delegate, ids, field = 'sortOrder', offset = 0) {
  await prisma.$transaction(ids.map((id, index) => delegate.update({ where: { id }, data: { [field]: offset + index } })));
}

module.exports = { applyOrder };
