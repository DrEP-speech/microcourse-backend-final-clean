function buildFollowUpQuestions(missedConcepts = []) {
  const unique = [...new Set(missedConcepts.filter(Boolean))].slice(0, 8);

  // Simple deterministic question templates that still feel “real”
  return unique.map((concept, idx) => {
    const c = String(concept).trim();
    const prompt = `Quick check: Which option best matches “${c}”?`;

    // Options are designed so #0 is correct but non-obvious; you can swap later.
    const options = [
      `A correct high-level description of ${c}`,
      `A common misconception about ${c}`,
      `An unrelated idea that sounds similar`,
      `A detail that is true sometimes, but not the definition`
    ];

    return {
      prompt,
      options,
      correctIndex: 0,
      conceptTag: c,
      difficulty: "easy",
      order: idx
    };
  });
}

module.exports = { buildFollowUpQuestions };
