const express = require('express');
const controller = require('../../controllers/admin/productsController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { statusUpdateSchema, idOnlySchema } = require('../../validators/common');
const {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
} = require('../../validators/productValidators');

const router = express.Router();

router.get('/', validate(listProductsSchema), controller.list);
router.post('/', upload.array('images', 6), validate(createProductSchema), controller.create);
router.put('/:id', upload.array('images', 6), validate(updateProductSchema), controller.update);
router.patch('/:id/status', validate(statusUpdateSchema), controller.setStatus);
router.delete('/:id', validate(idOnlySchema), controller.remove);

module.exports = router;
