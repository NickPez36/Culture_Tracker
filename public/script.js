let selectedRating = null;
let selectedName = "";

function selectName(name) {
  selectedName = name;
  checkSubmitEnabled();
}

function selectRating(rating) {
  selectedRating = rating;
  checkSubmitEnabled();
}

function checkSubmitEnabled() {
  const btn = document.getElementById("submitBtn");
  btn.disabled = !(selectedName && selectedRating);
}

async function submitFeedback() {
  try {
    const res = await fetch("/api/submitFeedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selectedName, rating: selectedRating })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(`Error: ${data.error || "Unknown error"}`);
      return;
    }

    alert(data.message || "Thank you for your feedback!");
    resetForm();

  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function resetForm() {
  selectedName = "";
  selectedRating = null;
  document.getElementById("submitBtn").disabled = true;
}

async function showAverage() {
  try {
    const res = await fetch("/api/getAverageRating");
    const data = await res.json();

    if (!res.ok) {
      alert(`Error: ${data.error || "Unknown error"}`);
      return;
    }

    if (data.average) {
      alert(`Average rating for the last week: ${data.average}`);
    } else {
      alert(data.message || "No data available");
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
