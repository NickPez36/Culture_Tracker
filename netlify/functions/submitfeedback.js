const fetch = require("node-fetch");

exports.handler = async (event) => {
  console.log("Incoming event:", event);

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { name, rating } = JSON.parse(event.body);
    console.log("Parsed body:", { name, rating });

    if (!name || !rating) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing name or rating" }) };
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    const csvPath = process.env.CSV_PATH || "data/data.csv";

    if (!token || !repo) {
      console.error("GitHub credentials missing");
      return { statusCode: 500, body: JSON.stringify({ error: "GitHub token or repo not configured" }) };
    }

    // Get current CSV
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${csvPath}`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3.raw" }
    });

    if (!getRes.ok) {
      const errText = await getRes.text();
      console.error("Failed to fetch CSV:", errText);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not read CSV from GitHub" }) };
    }

    const csvData = await getRes.text();
    const now = new Date().toISOString();
    const newLine = `${now},${name},${rating}`;
    const updatedCSV = csvData ? `${csvData}\n${newLine}` : `date,name,rating\n${newLine}`;

    // Encode to Base64 for GitHub API
    const base64Content = Buffer.from(updatedCSV).toString("base64");

    // Get file SHA for update
    const shaRes = await fetch(`https://api.github.com/repos/${repo}/contents/${csvPath}`, {
      headers: { Authorization: `token ${token}` }
    });
    const shaJson = await shaRes.json();

    // Update file on GitHub
    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${csvPath}`, {
      method: "PUT",
      headers: { Authorization: `token ${token}` },
      body: JSON.stringify({
        message: `Feedback added for ${name}`,
        content: base64Content,
        sha: shaJson.sha
      })
    });

    if (!putRes.ok) {
      const putErr = await putRes.text();
      console.error("Failed to update CSV:", putErr);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not update CSV on GitHub" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, message: "Feedback submitted" }) };

  } catch (err) {
    console.error("Error in submitFeedback:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
