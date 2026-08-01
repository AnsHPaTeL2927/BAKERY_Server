const express = require('express');
const controller = require('../../controllers/admin/galleryController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { statusUpdateSchema, idOnlySchema, reorderSchema } = require('../../validators/common');
const { createGallerySchema, updateGallerySchema, listGallerySchema } = require('../../validators/galleryValidators');

const router = express.Router();

router.get('/', validate(listGallerySchema), controller.list);
router.post('/', upload.single('image'), validate(createGallerySchema), controller.create);
router.patch('/reorder', validate(reorderSchema), controller.reorder);
router.put('/:id', upload.single('image'), validate(updateGallerySchema), controller.update);
router.patch('/:id/status', validate(statusUpdateSchema), controller.setStatus);
router.delete('/:id', validate(idOnlySchema), controller.remove);

module.exports = router;
