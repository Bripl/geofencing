document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.title;

  // Initialisation de la carte
  const map = L.map('map').setView([48.8566, 2.3522], 12); // Centré sur Paris

  // Ajouter les tuiles OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  if (pageTitle === 'Draw Polygon') {
    // Fonctionnalités pour tracer un polygone
    const drawnItems = new L.FeatureGroup().addTo(map);
    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polygon: true,
        rectangle: false,
        circle: false,
        marker: false,
        polyline: false,
      },
    }).addTo(map);

    map.on('draw:created', async function (event) {
      const layer = event.layer;
      drawnItems.addLayer(layer);

      const polygonCoordinates = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);

      // Envoi des coordonnées au backend
      await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygone: {
            type: 'Polygon',
            coordinates: [polygonCoordinates],
          },
        }),
      });
    });

  } else if (pageTitle === 'Show GPS Points') {
    // Fonctionnalités pour afficher les points GPS
    async function fetchGPSData() {
      const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/GPS');
      if (response.ok) {
        const data = await response.json();
        data.forEach(point => {
          const marker = L.marker([point.latitude, point.longitude]).addTo(map);
          marker.bindPopup(`Appareil: ${point.device_id}<br>Latitude: ${point.latitude}<br>Longitude: ${point.longitude}`);
        });
      } else {
        console.error('Erreur lors de la récupération des points GPS');
      }
    }

    fetchGPSData();
  }
});
