const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  try {
    const repo = process.env.GITHUB_REPO;
    const user = process.env.GITHUB_USER;
    const token = process.env.GITHUB_TOKEN;
    const path = process.env.CSV_PATH || 'data/data.csv';

    const res = await fetch(`https://raw.githubusercontent.com/${user}/${repo}/main/${path}`);
    if (!res.ok) {
      throw new Error(`GitHub fetch failed with status ${res.status}`);
    }

    const csv = await res.text();
    const lines = csv.trim().split('\n').slice(1); // skip header
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const ratings = lines
      .map(line => {
        const [date, name, rating] = line.split(',');
        return { date: new Date(date), rating: parseInt(rating, 10) };
      })
      .filter(row => row.date >= weekAgo)
      .map(row => row.rating);

    if (ratings.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No data for the last week' })
      };
    }

    const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
    return {
      statusCode: 200,
      body: JSON.stringify({ average: avg })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
