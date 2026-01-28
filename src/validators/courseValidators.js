const Joi = require("joi");

const createCourseSchema = Joi.object({
  title: Joi.string().min(3).max(120).required(),
  description: Joi.string().allow("").max(2000).default(""),
  level: Joi.string().valid("beginner", "intermediate", "advanced").default("beginner"),
  published: Joi.boolean().default(false),
});

module.exports = { createCourseSchema };
