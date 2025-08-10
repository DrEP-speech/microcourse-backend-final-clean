// controllers/courseController.js
import Course from '../models/Course.js';
import { asyncRoute, parsePagination, ok, created, fail } from './_utils.js';

const listCourses = async (req, res) => {
  try {
    const { skip, limit, sort, page } = parsePagination(req);
    const filter = req.query.q ? { title: new RegExp(req.query.q, 'i') } : {};
    const [items, total] = await Promise.all([
      Course.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Course.countDocuments(filter),
    ]);
    return ok(res, items, { page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return fail(res, err); }
};

const getCourse = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ success: false, message: 'Course not found' });
    return ok(res, c);
  } catch (err) { return fail(res, err); }
};

const createCourse = async (req, res) => {
  try {
    const c = await Course.create({ ...req.body, owner: req.user?.id });
    return created(res, { id: c._id });
  } catch (err) { return fail(res, err); }
};

const updateCourse = async (req, res) => {
  try {
    const c = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!c) return res.status(404).json({ success: false, message: 'Course not found' });
    return ok(res, c);
  } catch (err) { return fail(res, err); }
};

const deleteCourse = async (req, res) => {
  try {
    const c = await Course.findByIdAndDelete(req.params.id).lean();
    if (!c) return res.status(404).json({ success: false, message: 'Course not found' });
    return ok(res, { id: c._id });
  } catch (err) { return fail(res, err); }
};

export { listCourses, getCourse, createCourse, updateCourse, deleteCourse };
export default {
  listCourses: asyncRoute(listCourses),
  getCourse: asyncRoute(getCourse),
  createCourse: asyncRoute(createCourse),
  updateCourse: asyncRoute(updateCourse),
  deleteCourse: asyncRoute(deleteCourse),
};
