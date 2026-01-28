const mongoose = require("mongoose");

const breakdownSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    correct:    { type: Boolean, required: true },
    selected:   { type: [mongoose.Schema.Types.Mixed], default: [] },
    input:      { type: mongoose.Schema.Types.Mixed, default: null },
    awarded:    { type: Number, default: 0 }   // <-- ensure we keep the awarded points
  },
  { _id: false }
);

const quizResultSchema = new mongoose.Schema(
  {
    quizId:       { type: String, required: true, index: true },
    userId:       { type: String, required: true, index: true },
    score:        { type: Number, required: true },
    percentage:   { type: Number, required: true },
    correctCount: { type: Number, required: true },
    totalCount:   { type: Number, required: true },
    startedAt:    { type: Date,   required: true },
    submittedAt:  { type: Date,   required: true, index: true },
    breakdown:    { type: [breakdownSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.models.QuizResult || mongoose.model("QuizResult", quizResultSchema);
