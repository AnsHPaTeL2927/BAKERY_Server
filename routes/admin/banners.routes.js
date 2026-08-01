const express = require('express');
const controller = require('../../controllers/admin/bannersController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { statusUpdateSchema, idOnlySchema, reorderSchema } = require('../../validators/common');
const { createBannerSchema, updateBannerSchema, listBannersSchema } = require('../../validators/bannerValidators');

const router = express.Router();

router.get('/', validate(listBannersSchema), controller.list);
router.post('/', upload.single('image'), validate(createBannerSchema), controller.create);
router.patch('/reorder', validate(reorderSchema), controller.reorder);
router.put('/:id', upload.single('image'), validate(updateBannerSchema), controller.update);
router.patch('/:id/status', validate(statusUpdateSchema), controller.setStatus);
router.delete('/:id', validate(idOnlySchema), controller.remove);

module.exports = router;
