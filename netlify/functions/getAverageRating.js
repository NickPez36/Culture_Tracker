// netlify/functions/getAverageRating.js
const {
  ensureCsv, parseCsv, toSydneyYMD, getFile
} = require("./_shared/github");

exports.handler = async () => {
  try {
    await ensureCsv();
    const current = await getFile();
    const rows = parseCsv(current.content);

    // Today in Sydney, last 7-day window (today and previous 6 days)
    const todayYMD = toSydneyYMD();
    const [Y,M,D] = todayYMD.split("-").map(Number);
    const today = new Date(Date.UTC(Y, M-1, D)); // normalize
    const start = new Date(today);
    start.setUTCDate(today.getUTCDate() - 6);

    const within = rows.filter(r => {
      const [y,m,d] = r.date.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m-1, d));
      return dt >= start && dt <= today;
    });

    const count = within.length;
    const average = count ? within.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ average, count, from: start.toISOString().slice(0,10), to: todayYMD })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: err.message || "Internal error" })
    };
  }
};
