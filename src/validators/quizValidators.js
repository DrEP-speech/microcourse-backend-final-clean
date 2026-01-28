const Joi = require("joi");

const questionSchema = Joi.object({
  prompt: Joi.string().min(1).required(),
  options: Joi.array().items(Joi.string().min(1)).min(2).required(),
  correctIndex: Joi.number().integer().min(0).required(),
  conceptTag: Joi.string().allow("").max(120).default(""),
  points: Joi.number().min(0).default(1)
});

const quizCreateSchema = Joi.object({
  lessonId: Joi.string().required(),
  title: Joi.string().min(2).max(200).required(),
  questions: Joi.array().items(questionSchema).default([]),
  published: Joi.boolean().default(false)
});

const quizUpdateSchema = Joi.object({
  title: Joi.string().min(2).max(200).optional(),
  questions: Joi.array().items(questionSchema).optional(),
  published: Joi.boolean().optional()
});

const submitSchema = Joi.object({
  answers: Joi.array().items(
    Joi.object({
      questionIndex: Joi.number().integer().min(0).required(),
      selectedIndex: Joi.number().integer().min(-1).required()
    })
  ).required()
});

module.exports = { quizCreateSchema, quizUpdateSchema, submitSchema };
