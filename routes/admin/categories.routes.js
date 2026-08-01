const express = require('express');
const controller = require('../../controllers/admin/categoriesController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { statusUpdateSchema, idOnlySchema, reorderSchema } = require('../../validators/common');
const {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesSchema,
} = require('../../validators/categoryValidators');

const router = express.Router();

router.get('/', validate(listCategoriesSchema), controller.list);
router.post('/', upload.single('image'), validate(createCategorySchema), controller.create);
router.patch('/reorder', validate(reorderSchema), controller.reorder);
router.put('/:id', upload.single('image'), validate(updateCategorySchema), controller.update);
router.patch('/:id/status', validate(statusUpdateSchema), controller.setStatus);
router.delete('/:id', validate(idOnlySchema), controller.remove);

module.exports = router;
