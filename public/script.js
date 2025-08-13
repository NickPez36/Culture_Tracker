let selectedRating = null;

function selectRating(rating) {
  selectedRating = rating;

  // Highlight selected rating
  document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
  document.querySelectorAll('.rating-btn')[rating - 1].classList.add('selected');

  checkFormCompletion();
}

function checkFormCompletion() {
  const name = document.getElementById('name').value;
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = !(name && selectedRating);
}

async function submitFeedback() {
  const name = document.getElementById('name').value;
  const messageEl = document.getElementById('feedback-message');

  try {
    const res = await fetch('/.netlify/functions/submitFeedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rating: selectedRating })
    });

    if (!res.ok) throw new Error(await res.text());

    // Show thank-you message
    messageEl.style.display = 'block';
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);

    // Reset form
    document.getElementById('name').value = "";
    selectedRating = null;
    document.querySelectorAll('.rating-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('submit-btn').disabled = true;

  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function showAverage() {
  const output = document.getElementById('average-output');
  try {
    const res = await fetch('/.netlify/functions/getAverageRating');
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    output.textContent = `Average rating (last 7 days): ${data.average.toFixed(2)}`;

  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
