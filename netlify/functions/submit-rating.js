// netlify/functions/submit-rating.js
// This function validates and writes a new submission to the data.csv file.

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
        const { name, rating } = JSON.parse(event.body);
        if (!name || !rating) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Missing name or rating.' }) };
        }

        const { GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO } = process.env;
        const filePath = 'data/data.csv';
        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filePath}`;

        // STEP 1: Get the current file content and SHA
        const getFileResponse = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!getFileResponse.ok) {
            // Handle case where file might not exist yet, though we created it.
            if (getFileResponse.status === 404) {
                 return { statusCode: 500, body: JSON.stringify({ message: 'data/data.csv not found in repository.' }) };
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
                statusCode: 409, // 409 Conflict is a good status code for this
                body: JSON.stringify({ message: 'You have already submitted your rating for today.' })
            };
        }

        // STEP 3: Append new data and encode
        const newRecord = `\n${new Date().toISOString()},${name},${rating}`;
        const updatedContent = currentContent.trim() + newRecord; // Use trim to avoid leading blank lines
        const updatedContentBase64 = Buffer.from(updatedContent).toString('base64');

        // STEP 4: Push the updated file back to GitHub
        const updateFileResponse = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `feat: Add new culture rating for ${name}`,
                content: updatedContentBase64,
                sha: currentSha, // IMPORTANT: Provide the SHA of the file you're updating
            })
        });
        
        if (!updateFileResponse.ok) {
            const errorBody = await updateFileResponse.json();
            console.error("GitHub API PUT Error:", errorBody);
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
