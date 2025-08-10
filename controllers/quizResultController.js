// controllers/quizResultController.js
import QuizResult from '../models/QuizResult.js';
import { asyncRoute, parsePagination, ok, created, fail, requireFields } from './_utils.js';

const listResults = async (req, res) => {
  try {
    const { skip, limit, sort, page } = parsePagination(req);
    const filter = {};
    if (req.query.userId) filter.user = req.query.userId;
    if (req.query.quizId) filter.quiz = req.query.quizId;

    const [items, total] = await Promise.all([
      QuizResult.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      QuizResult.countDocuments(filter),
    ]);
    return ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return fail(res, err); }
};

const createResult = async (req, res) => {
  try {
    requireFields(req.body || {}, ['user', 'quiz', 'score']);
    const r = await QuizResult.create({ ...req.body, createdBy: req.user?.id });
    return created(res, { id: r._id });
  } catch (err) { return fail(res, err); }
};

const getResult = async (req, res) => {
  try {
    const r = await QuizResult.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ success: false, message: 'Result not found' });
    return ok(res, r);
  } catch (err) { return fail(res, err); }
};

export { listResults, createResult, getResult };
export default {
  listResults: asyncRoute(listResults),
  createResult: asyncRoute(createResult),
  getResult: asyncRoute(getResult),
};
