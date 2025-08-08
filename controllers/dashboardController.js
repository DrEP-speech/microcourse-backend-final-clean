// controllers/dashboardController.js
export const getDashboardSummary = async (req, res) => {
  res.json({
    message: 'Dashboard summary',
    userId: req.user._id,
  });
};
