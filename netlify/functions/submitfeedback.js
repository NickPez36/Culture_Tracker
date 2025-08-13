const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { Base64 } = require('js-base64');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { name, rating } = JSON.parse(event.body);
    if (!name || !rating) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing name or rating' }) };
    }

    const repo = process.env.GITHUB_REPO;
    const user = process.env.GITHUB_USER;
    const token = process.env.GITHUB_TOKEN;
    const path = process.env.CSV_PATH || 'data/data.csv';

    // Get current CSV file from GitHub
    const fileRes = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/${path}`, {
      headers: { Authorization: `token ${token}` }
    });

    if (!fileRes.ok) throw new Error(`GitHub fetch failed with status ${fileRes.status}`);
    const fileData = await fileRes.json();

    const csv = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const today = new Date().toISOString().split('T')[0];
    const rows = csv.trim().split('\n');

    // Prevent multiple submissions in the same day
    const alreadySubmitted = rows.some(line => {
      const [date, person] = line.split(',');
      return date === today && person === name;
    });
    if (alreadySubmitted) {
      return { statusCode: 400, body: JSON.stringify({ error: 'You have already submitted today' }) };
    }

    // Append new line
    const newLine = `${today},${name},${rating}`;
    const newCsv = csv + '\n' + newLine;

    // Update GitHub file
    const updateRes = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Add feedback entry',
        content: Base64.encode(newCsv),
        sha: fileData.sha
      })
    });

    if (!updateRes.ok) throw new Error(`GitHub update failed with status ${updateRes.status}`);

    return { statusCode: 200, body: JSON.stringify({ message: 'Thank you for your feedback!' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
