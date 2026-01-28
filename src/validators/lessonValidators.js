const Joi = require("joi");

const lessonCreateSchema = Joi.object({
  courseId: Joi.string().required(),
  title: Joi.string().min(2).max(200).required(),
  content: Joi.string().allow("").max(20000).default(""),
  videoUrl: Joi.string().allow("").max(2000).default(""),
  order: Joi.number().integer().min(0).default(0)
});

const lessonUpdateSchema = Joi.object({
  title: Joi.string().min(2).max(200).optional(),
  content: Joi.string().allow("").max(20000).optional(),
  videoUrl: Joi.string().allow("").max(2000).optional(),
  order: Joi.number().integer().min(0).optional()
});

module.exports = { lessonCreateSchema, lessonUpdateSchema };
