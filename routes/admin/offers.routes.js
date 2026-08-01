const express = require('express');
const controller = require('../../controllers/admin/offersController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { statusUpdateSchema, idOnlySchema } = require('../../validators/common');
const { createOfferSchema, updateOfferSchema, listOffersSchema } = require('../../validators/offerValidators');

const router = express.Router();

router.get('/', validate(listOffersSchema), controller.list);
router.post('/', upload.single('banner'), validate(createOfferSchema), controller.create);
router.put('/:id', upload.single('banner'), validate(updateOfferSchema), controller.update);
router.patch('/:id/status', validate(statusUpdateSchema), controller.setStatus);
router.delete('/:id', validate(idOnlySchema), controller.remove);

module.exports = router;
