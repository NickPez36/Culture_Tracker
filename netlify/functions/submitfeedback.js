// netlify/functions/submitFeedback.js
const {
  ensureCsv, parseCsv, toCsv, putFile, toSydneyYMD, toSydneyTime, getFile
} = require("./_shared/github");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { message: "Method not allowed" });
    }
    const { name, rating } = JSON.parse(event.body || "{}");
    if (!name || ![1,2,3,4,5].includes(Number(rating))) {
      return json(400, { message: "Invalid name or rating" });
    }

    // Ensure CSV exists, then load latest content+sha
    await ensureCsv();
    const current = await getFile(); // {content, sha}
    const rows = parseCsv(current.content);

    const today = toSydneyYMD();
    const already = rows.some(r => r.date === today && r.name === name);
    if (already) {
      return json(409, { message: "You have already submitted today" });
    }

    const now = new Date();
    const newRow = {
      date: today,
      time: toSydneyTime(now),
      name,
      rating: Number(rating)
    };

    const nextRows = [...rows, newRow];
    const nextCsv = toCsv(nextRows);
    await putFile(nextCsv, current.sha, `Add feedback: ${name} ${today}`);

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { message: err.message || "Internal error" });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
