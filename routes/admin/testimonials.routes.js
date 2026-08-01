const express = require('express');
const controller = require('../../controllers/admin/testimonialsController');
const { validate } = require('../../middleware/validate');
const { upload } = require('../../middleware/upload');
const { statusUpdateSchema, idOnlySchema } = require('../../validators/common');
const {
  createTestimonialSchema,
  updateTestimonialSchema,
  listTestimonialsSchema,
} = require('../../validators/testimonialValidators');

const router = express.Router();

router.get('/', validate(listTestimonialsSchema), controller.list);
router.post('/', upload.single('photo'), validate(createTestimonialSchema), controller.create);
router.put('/:id', upload.single('photo'), validate(updateTestimonialSchema), controller.update);
router.patch('/:id/status', validate(statusUpdateSchema), controller.setStatus);
router.delete('/:id', validate(idOnlySchema), controller.remove);

module.exports = router;
