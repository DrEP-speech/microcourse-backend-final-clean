// controllers/lessonController.js
import Lesson from '../models/Lesson.js';
import { asyncRoute, parsePagination, ok, created, fail } from './_utils.js';

const listLessons = async (req, res) => {
  try {
    const { skip, limit, sort, page } = parsePagination(req);
    const filter = req.query.courseId ? { course: req.query.courseId } : {};
    const [items, total] = await Promise.all([
      Lesson.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Lesson.countDocuments(filter),
    ]);
    return ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return fail(res, err); }
};

const getLesson = async (req, res) => {
  try {
    const l = await Lesson.findById(req.params.id).lean();
    if (!l) return res.status(404).json({ success: false, message: 'Lesson not found' });
    return ok(res, l);
  } catch (err) { return fail(res, err); }
};

const createLesson = async (req, res) => {
  try {
    const l = await Lesson.create(req.body);
    return created(res, { id: l._id });
  } catch (err) { return fail(res, err); }
};

const updateLesson = async (req, res) => {
  try {
    const l = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!l) return res.status(404).json({ success: false, message: 'Lesson not found' });
    return ok(res, l);
  } catch (err) { return fail(res, err); }
};

const deleteLesson = async (req, res) => {
  try {
    const l = await Lesson.findByIdAndDelete(req.params.id).lean();
    if (!l) return res.status(404).json({ success: false, message: 'Lesson not found' });
    return ok(res, { id: l._id });
  } catch (err) { return fail(res, err); }
};

export { listLessons, getLesson, createLesson, updateLesson, deleteLesson };
export default {
  listLessons: asyncRoute(listLessons),
  getLesson: asyncRoute(getLesson),
  createLesson: asyncRoute(createLesson),
  updateLesson: asyncRoute(updateLesson),
  deleteLesson: asyncRoute(deleteLesson),
};
