// backend/utils/auditBadgeExport.js
import fs from 'fs';
import { Parser } from 'json2csv';

export const exportBadgeAuditLog = async (logEntries, filePath) => {
  const parser = new Parser();
  const csv = parser.parse(logEntries);
  fs.writeFileSync(filePath, csv);
};
