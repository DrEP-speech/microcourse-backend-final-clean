export const debug = (req, res) => {
  res.json({ message: 'Debug route working', timestamp: new Date() });
};
