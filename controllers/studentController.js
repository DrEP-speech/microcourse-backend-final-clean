// controllers/studentController.js

export const getStudentCourses = async (req, res) => {
  try {
    const studentId = req.user.id;
    // Fetch enrolled courses
    const courses = []; // Replace with DB fetch
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get courses' });
  }
};

export const getStudentQuizResults = async (req, res) => {
  try {
    const studentId = req.user.id;
    // Fetch quiz results for student
    const results = []; // Replace with DB fetch
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get quiz results' });
  }
};

export const getSingleQuizToTake = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    // Fetch quiz by ID (excluding answers)
    res.json({ quizId, title: 'Sample Quiz', questions: [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load quiz' });
  }
};
