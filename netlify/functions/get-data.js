// netlify/functions/get-data.js
// This function reads the data.csv file from your GitHub repo.

const fetch = require('node-fetch');

// Helper function to parse CSV data
const parseCSV = (csv) => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return []; // Return empty if only headers or empty
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header.trim()] = values[index] ? values[index].trim() : '';
            return obj;
        }, {});
    });
};

exports.handler = async (event, context) => {
    const { GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO } = process.env;
    const filePath = 'data/data.csv';
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filePath}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw' // Get raw content directly
            }
        });

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ message: `Error fetching file: ${response.statusText}` })
            };
        }

        const csvData = await response.text();
        const records = parseCSV(csvData);

        // --- DATA PROCESSING ---
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recentRecords = records.filter(r => r.timestamp && new Date(r.timestamp) >= sevenDaysAgo);

        // Calculate overall 7-day average
        const totalRating = recentRecords.reduce((sum, record) => sum + parseInt(record.rating, 10), 0);
        const sevenDayAverage = recentRecords.length > 0 ? totalRating / recentRecords.length : 0;

        // Calculate average per day for the last 7 days
        const dailyData = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0];
            dailyData[dateString] = { total: 0, count: 0, date: dateString };
        }

        recentRecords.forEach(record => {
            if (record.timestamp && record.rating) {
                const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
                if (dailyData[recordDate]) {
                    dailyData[recordDate].total += parseInt(record.rating, 10);
                    dailyData[recordDate].count++;
                }
            }
        });
        
        const dailyAverages = Object.values(dailyData)
            .map(day => ({
                date: day.date,
                average: day.count > 0 ? day.total / day.count : 0
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort from oldest to newest

        return {
            statusCode: 200,
            body: JSON.stringify({
                sevenDayAverage,
                dailyAverages
            })
        };

    } catch (error) {
        console.error('Error in get-data function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' })
        };
    }
};
