// netlify/functions/get-data.js
// This function reads BOTH team_roles.csv and data.csv from your GitHub repo.

const fetch = require('node-fetch');

// Helper function to parse CSV data safely
const parseCSV = (csv) => {
    if (!csv || typeof csv !== 'string') return [];
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return []; // Return empty if only headers or empty
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] ? values[index].trim() : '';
            return obj;
        }, {});
    });
};

// Helper to check if two dates are on the same day (in UTC)
const isSameDay = (date1, date2) => {
    return date1.getUTCFullYear() === date2.getUTCFullYear() &&
           date1.getUTCMonth() === date2.getUTCMonth() &&
           date1.getUTCDate() === date2.getUTCDate();
};


exports.handler = async (event, context) => {
    const { GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO } = process.env;
    const baseApiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/`;

    const fetchOptions = {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.raw'
        }
    };

    try {
        // Fetch both files in parallel for efficiency
        const [rolesResponse, dataResponse] = await Promise.all([
            fetch(`${baseApiUrl}data/team_roles.csv`, fetchOptions),
            fetch(`${baseApiUrl}data/data.csv`, fetchOptions)
        ]);

        if (!rolesResponse.ok) {
             return { statusCode: rolesResponse.status, body: JSON.stringify({ message: `Error fetching team_roles.csv: ${rolesResponse.statusText}` }) };
        }
        if (!dataResponse.ok) {
             return { statusCode: dataResponse.status, body: JSON.stringify({ message: `Error fetching data.csv: ${dataResponse.statusText}` }) };
        }

        const [rolesCsv, dataCsv] = await Promise.all([
            rolesResponse.text(),
            dataResponse.text()
        ]);

        // --- DATA PROCESSING ---
        const teamMembers = parseCSV(rolesCsv);
        const allRecords = parseCSV(dataCsv);

        // Find who has submitted today
        const today = new Date();
        const submittedToday = allRecords
            .filter(r => r.timestamp && isSameDay(new Date(r.timestamp), today))
            .map(r => r.name);

        // Calculate 7-day metrics
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recentRecords = allRecords.filter(r => r.timestamp && new Date(r.timestamp) >= sevenDaysAgo);

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
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return {
            statusCode: 200,
            body: JSON.stringify({
                teamMembers,
                submittedToday,
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
