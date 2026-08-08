const express = require('express');
const controller = require('../../controllers/admin/ordersController');
const { validate } = require('../../middleware/validate');
const { idOnlySchema } = require('../../validators/common');
const { createOrderSchema, updateOrderSchema, listOrdersSchema } = require('../../validators/orderValidators');

const router = express.Router();

router.get('/', validate(listOrdersSchema), controller.list);
router.post('/', validate(createOrderSchema), controller.create);
router.put('/:id', validate(updateOrderSchema), controller.update);
router.post('/:id/invoice', validate(idOnlySchema), controller.generateInvoicePdf);
router.get('/:id/timeline', validate(idOnlySchema), controller.getTimeline);
router.delete('/:id', validate(idOnlySchema), controller.remove);

module.exports = router;
