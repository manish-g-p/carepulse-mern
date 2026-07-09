const ExcelJS = require("exceljs");

const formatElapsed = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

// Builds the transcript workbook a doctor downloads for a patient — this is
// the sheet that's meant to help with "when to take which tablet" after the
// visit, so it's generated fresh at download time (not cached from Stop) so
// it always reflects the latest speaker-role relabeling from Day 5.
const buildTranscriptWorkbook = (session) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CarePulse";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Transcript");

  sheet.addRow(["Patient", session.patientName]);
  sheet.addRow(["Date", new Date(session.startedAt).toLocaleString()]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };
  sheet.addRow([]);

  const hasTranslation = (session.segments || []).some((seg) => seg.translatedText);
  const headers = ["Time", "Speaker", "Statement"];
  if (hasTranslation) headers.push(`Translation (${session.languagePair})`);
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };

  const roles = session.speakerRoles instanceof Map ? session.speakerRoles : new Map(Object.entries(session.speakerRoles || {}));

  for (const seg of session.segments || []) {
    const row = [formatElapsed(seg.startMs), roles.get(seg.speaker) || seg.speaker, seg.text];
    if (hasTranslation) row.push(seg.translatedText || "");
    sheet.addRow(row);
  }

  sheet.columns = hasTranslation
    ? [{ width: 10 }, { width: 20 }, { width: 60 }, { width: 60 }]
    : [{ width: 10 }, { width: 20 }, { width: 90 }];
  sheet.getColumn(3).alignment = { wrapText: true, vertical: "top" };
  if (hasTranslation) sheet.getColumn(4).alignment = { wrapText: true, vertical: "top" };

  return workbook;
};

module.exports = { buildTranscriptWorkbook };
