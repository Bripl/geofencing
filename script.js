// Initialisation de la carte Leaflet
const map = L.map('map').setView([48.8566, 2.3522], 12); // Centré sur Paris avec un zoom de 12

// Ajouter les tuiles OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Fonction pour récupérer les données GPS depuis votre backend
async function fetchGpsData() {
  try {
    const response = await fetch('https://votre-backend.herokuapp.com/api/gps-data'); // URL de votre backend Heroku
    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur lors de la récupération des données:', data.error);
      return [];
    }

    return data;
  } catch (err) {
    console.error('Erreur lors de la récupération des données:', err);
    return [];
  }
}

// Afficher les données GPS sur la carte
async function displayGpsData() {
  const gpsData = await fetchGpsData(); // Récupérer les données GPS depuis le backend

  gpsData.forEach((point) => {
    const marker = L.marker([point.latitude, point.longitude]).addTo(map); // Ajouter un marqueur pour chaque point GPS

    // Ajouter une popup avec des informations sur le point
    marker.bindPopup(`
      <div>
        <strong>Device ID:</strong> ${point.device_id}<br>
        <strong>Latitude:</strong> ${point.latitude}<br>
        <strong>Longitude:</strong> ${point.longitude}<br>
        <strong>Timestamp:</strong> ${point.timestamp}
      </div>
    `);
  });
}

// Charger et afficher les données GPS
displayGpsData();
