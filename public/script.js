let selectedRating = null;

function selectRating(rating) {
  selectedRating = rating;
  document.querySelectorAll('#ratings button').forEach(btn => btn.classList.remove('selected'));
  document.querySelectorAll('#ratings button')[rating - 1].classList.add('selected');
  checkFormReady();
}

function checkFormReady() {
  const name = document.getElementById('name').value;
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = !(name && selectedRating);
}

async function submitSelection() {
  const name = document.getElementById('name').value;
  const messageEl = document.getElementById('feedback-message');

  try {
    const res = await fetch('/api/submitFeedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rating: selectedRating })
    });

    if (!res.ok) throw new Error(await res.text());

    messageEl.classList.remove('hidden');
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 3000);

    // Reset form
    document.getElementById('name').value = "";
    selectedRating = null;
    document.querySelectorAll('#ratings button').forEach(btn => btn.classList.remove('selected'));
    checkFormReady();

  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function showAverage() {
  const output = document.getElementById('average-output');
  try {
    const res = await fetch('/api/getAverageRating');
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    output.textContent = `Average rating (last 7 days): ${data.average.toFixed(2)}`;
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
