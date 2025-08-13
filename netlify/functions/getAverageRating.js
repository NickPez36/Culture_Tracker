const fetch = require("node-fetch");

exports.handler = async () => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    const csvPath = process.env.CSV_PATH || "data/data.csv";

    if (!token || !repo) {
      return { statusCode: 500, body: JSON.stringify({ error: "GitHub token or repo not configured" }) };
    }

    // Get CSV
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${csvPath}`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3.raw" }
    });

    if (!getRes.ok) {
      const errText = await getRes.text();
      console.error("Failed to fetch CSV:", errText);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not read CSV from GitHub" }) };
    }

    const csvData = await getRes.text();
    const lines = csvData.trim().split("\n").slice(1); // remove header
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const ratings = lines
      .map(line => {
        const [date, , rating] = line.split(",");
        return { date: new Date(date), rating: Number(rating) };
      })
      .filter(row => row.date.getTime() >= oneWeekAgo)
      .map(row => row.rating);

    if (!ratings.length) {
      return { statusCode: 200, body: JSON.stringify({ average: null, message: "No data for the last week" }) };
    }

    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return { statusCode: 200, body: JSON.stringify({ average: avg.toFixed(2) }) };

  } catch (err) {
    console.error("Error in getAverageRating:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
