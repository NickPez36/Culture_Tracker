// netlify/functions/get-data.js
// This function reads all three CSV files and calculates stats for all, athletes, and staff.

const fetch = require('node-fetch');

// Helper function to parse CSV data safely
const parseCSV = (csv) => {
    if (!csv || typeof csv !== 'string') return [];
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
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

// Helper function to calculate statistics for a given set of records
const calculateStats = (records) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentRecords = records.filter(r => r.timestamp && new Date(r.timestamp) >= sevenDaysAgo);

    const totalRating = recentRecords.reduce((sum, record) => sum + parseInt(record.rating, 10), 0);
    const sevenDayAverage = recentRecords.length > 0 ? totalRating / recentRecords.length : 0;

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

    return { sevenDayAverage, dailyAverages };
};


exports.handler = async (event, context) => {
    const { GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO } = process.env;
    const baseApiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/`;
    const fetchOptions = { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' } };

    try {
        const [rolesResponse, dataResponse, reasonsResponse] = await Promise.all([
            fetch(`${baseApiUrl}data/team_roles.csv`, fetchOptions),
            fetch(`${baseApiUrl}data/data.csv`, fetchOptions),
            fetch(`${baseApiUrl}data/reasons.csv`, fetchOptions)
        ]);

        if (!rolesResponse.ok) return { statusCode: 500, body: JSON.stringify({ message: `Error fetching team_roles.csv` }) };
        if (!dataResponse.ok) return { statusCode: 500, body: JSON.stringify({ message: `Error fetching data.csv` }) };
        if (!reasonsResponse.ok) return { statusCode: 500, body: JSON.stringify({ message: `Error fetching reasons.csv` }) };

        const [rolesCsv, dataCsv, reasonsCsv] = await Promise.all([ rolesResponse.text(), dataResponse.text(), reasonsResponse.text() ]);

        const teamMembers = parseCSV(rolesCsv);
        const allRecords = parseCSV(dataCsv);
        const reasons = parseCSV(reasonsCsv);

        const groupedTeamMembers = teamMembers.reduce((acc, member) => {
            const role = member.Role || 'Unassigned';
            if (!acc[role]) acc[role] = [];
            acc[role].push(member);
            return acc;
        }, {});

        const today = new Date();
        const submittedToday = allRecords
            .filter(r => r.timestamp && isSameDay(new Date(r.timestamp), today))
            .map(r => r.name);

        // Filter records by role
        const athleteNames = teamMembers.filter(m => m.Role === 'Athlete').map(m => m.PersonName);
        const staffNames = teamMembers.filter(m => m.Role === 'Staff').map(m => m.PersonName);
        
        const athleteRecords = allRecords.filter(r => athleteNames.includes(r.name));
        const staffRecords = allRecords.filter(r => staffNames.includes(r.name));

        // Calculate stats for each view
        const stats = {
            'Team': calculateStats(allRecords),
            'Athlete': calculateStats(athleteRecords),
            'Staff': calculateStats(staffRecords)
        };

        return {
            statusCode: 200,
            body: JSON.stringify({
                teamMembers: groupedTeamMembers,
                submittedToday,
                reasons,
                stats
            })
        };

    } catch (error) {
        console.error('Error in get-data function:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
    }
};
