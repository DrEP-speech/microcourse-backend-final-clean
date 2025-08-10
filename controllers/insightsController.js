// controllers/insightsController.js
import { asyncRoute, ok, fail } from './_utils.js';
// TODO: wire real analytics + AI provider later

const teacherSummaryInsights = async (_req, res) => {
  try {
    // Aggregate hardest questions, topics, improvements...
    return ok(res, {
      hardestQuestions: [],
      topImprovements: [],
      atRiskStudents: [],
    });
  } catch (err) { return fail(res, err); }
};

const aiFeedbackForResult = async (req, res) => {
  try {
    const { resultId } = req.params;
    // const feedback = await aiClient.generate({ resultId });
    return ok(res, { resultId, feedback: 'Personalized AI feedback goes here.' });
  } catch (err) { return fail(res, err); }
};

export { teacherSummaryInsights, aiFeedbackForResult };
export default {
  teacherSummaryInsights: asyncRoute(teacherSummaryInsights),
  aiFeedbackForResult: asyncRoute(aiFeedbackForResult),
};
