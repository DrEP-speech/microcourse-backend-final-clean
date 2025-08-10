// controllers/pdfController.js
import { asyncRoute, ok, created, fail, requireFields } from './_utils.js';
// TODO: integrate a PDF generator (pdf-lib, Puppeteer, Playwright serverless, etc.)

const generateQuizReport = async (req, res) => {
  try {
    requireFields(req.body || {}, ['quizId', 'userId']);
    // const buffer = await renderQuizPdf(req.body);
    // res.setHeader('Content-Type', 'application/pdf');
    // return res.send(buffer);
    return ok(res, { status: 'stub', message: 'PDF generation wired later' });
  } catch (err) { return fail(res, err); }
};

export { generateQuizReport };
export default { generateQuizReport: asyncRoute(generateQuizReport) };
