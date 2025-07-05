async function sendSearch() {
  const query = document.getElementById('searchBox').value.trim();
  if (!query) return alert("Please type something to search.");

  document.getElementById('results').innerHTML = `<p>Searching for "<strong>${query}</strong>"...</p>`;

  try {
    const response = await fetch('https://fweb-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    document.getElementById('results').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  } catch (error) {
    document.getElementById('results').innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  }
}
