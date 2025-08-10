// controllers/quizController.js
import Quiz from '../models/Quiz.js';
import { asyncRoute, parsePagination, ok, created, fail, requireFields } from './_utils.js';

const listQuizzes = async (req, res) => {
  try {
    const { skip, limit, sort, page } = parsePagination(req);
    const filter = req.query.courseId ? { course: req.query.courseId } : {};
    const [items, total] = await Promise.all([
      Quiz.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Quiz.countDocuments(filter),
    ]);
    return ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return fail(res, err); }
};

const getQuiz = async (req, res) => {
  try {
    const q = await Quiz.findById(req.params.id).lean();
    if (!q) return res.status(404).json({ success: false, message: 'Quiz not found' });
    return ok(res, q);
  } catch (err) { return fail(res, err); }
};

const createQuiz = async (req, res) => {
  try {
    requireFields(req.body || {}, ['title']);
    const q = await Quiz.create({ ...req.body, owner: req.user?.id });
    return created(res, { id: q._id });
  } catch (err) { return fail(res, err); }
};

const updateQuiz = async (req, res) => {
  try {
    const q = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!q) return res.status(404).json({ success: false, message: 'Quiz not found' });
    return ok(res, q);
  } catch (err) { return fail(res, err); }
};

const deleteQuiz = async (req, res) => {
  try {
    const q = await Quiz.findByIdAndDelete(req.params.id).lean();
    if (!q) return res.status(404).json({ success: false, message: 'Quiz not found' });
    return ok(res, { id: q._id });
  } catch (err) { return fail(res, err); }
};

export { listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz };
export default {
  listQuizzes: asyncRoute(listQuizzes),
  getQuiz: asyncRoute(getQuiz),
  createQuiz: asyncRoute(createQuiz),
  updateQuiz: asyncRoute(updateQuiz),
  deleteQuiz: asyncRoute(deleteQuiz),
};
