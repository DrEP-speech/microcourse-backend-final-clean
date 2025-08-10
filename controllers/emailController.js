// controllers/emailController.js
import { asyncRoute, ok, created, fail, requireFields } from './_utils.js';
// TODO: plug in your real mailer (Nodemailer/Resend/etc.)
const sendEmail = async (req, res) => {
  try {
    const { to, subject, html } = req.body || {};
    requireFields({ to, subject, html }, ['to', 'subject', 'html']);
    // await mailer.send({ to, subject, html });
    return created(res, { status: 'queued' });
  } catch (err) { return fail(res, err); }
};

const previewEmail = async (req, res) => {
  try {
    return ok(res, { html: req.body?.html ?? '' });
  } catch (err) { return fail(res, err); }
};

export { sendEmail, previewEmail };
export default {
  sendEmail: asyncRoute(sendEmail),
  previewEmail: asyncRoute(previewEmail),
};
