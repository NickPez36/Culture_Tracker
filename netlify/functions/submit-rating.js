// netlify/functions/submit-rating.js
// This function validates and writes a new submission, including the reason, to data.csv.

const fetch = require('node-fetch');

// Helper to check if two dates are on the same day (in UTC)
const isSameDay = (date1, date2) => {
    return date1.getUTCFullYear() === date2.getUTCFullYear() &&
           date1.getUTCMonth() === date2.getUTCMonth() &&
           date1.getUTCDate() === date2.getUTCDate();
};

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { name, rating, reason } = JSON.parse(event.body);
        if (!name || !rating || !reason) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Missing name, rating, or reason.' }) };
        }

        const { GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO } = process.env;
        const filePath = 'data/data.csv';
        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filePath}`;

        // STEP 1: Get the current file content and SHA
        const getFileResponse = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!getFileResponse.ok) {
            if (getFileResponse.status === 404) {
                 return { statusCode: 500, body: JSON.stringify({ message: 'data/data.csv not found.' }) };
            }
            throw new Error(`GitHub API error (GET): ${getFileResponse.statusText}`);
        }

        const fileData = await getFileResponse.json();
        const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const currentSha = fileData.sha;

        // STEP 2: Validate the submission (check for duplicates today)
        const lines = currentContent.trim().split('\n');
        const today = new Date();
        const hasSubmittedToday = lines.slice(1).some(line => {
            const [timestamp, userName] = line.split(',');
            if (userName && userName.trim() === name) {
                return isSameDay(new Date(timestamp), today);
            }
            return false;
        });

        if (hasSubmittedToday) {
            return {
                statusCode: 409,
                body: JSON.stringify({ message: 'You have already submitted your rating for today.' })
            };
        }

        // STEP 3: Append new data and encode
        // Sanitize reason to remove commas that would break the CSV format
        const sanitizedReason = reason.replace(/,/g, ''); 
        const newRecord = `\n${new Date().toISOString()},${name},${rating},${sanitizedReason}`;
        const updatedContent = currentContent.trim() + newRecord;
        const updatedContentBase64 = Buffer.from(updatedContent).toString('base64');

        // STEP 4: Push the updated file back to GitHub
        const updateFileResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `feat: Add culture rating for ${name}`,
                content: updatedContentBase64,
                sha: currentSha,
            })
        });
        
        if (!updateFileResponse.ok) {
            throw new Error(`GitHub API error (PUT): ${updateFileResponse.statusText}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Submission successful!' })
        };

    } catch (error) {
        console.error('Error in submit-rating function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
        };
    }
};
