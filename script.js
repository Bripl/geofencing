document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.title;

  const map = L.map('map').setView([48.8566, 2.3522], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Page: Show GPS Points
  if (pageTitle === 'Show GPS Points') {
    async function fetchGpsPoints() {
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/GPS?limit=100');
        if (response.ok) {
          const gpsPoints = await response.json();
          gpsPoints.forEach(point => {
            const marker = L.marker([point.latitude, point.longitude]).addTo(map);
            marker.bindPopup(`Device: ${point.device_id}<br>Timestamp: ${point.timestamp}`);
          });
        } else {
          console.error('Erreur lors de la récupération des points GPS');
        }
      } catch (error) {
        console.error('Erreur de connexion au serveur pour les points GPS:', error);
      }
    }

    fetchGpsPoints();
  }

  // Page: Draw Polygon
  if (pageTitle === 'Draw Polygon') {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: { polygon: true, circle: false, marker: false, polyline: false, rectangle: false },
    });
    map.addControl(drawControl);

    map.on('draw:created', async (e) => {
      const type = e.layerType;
      const layer = e.layer;

      if (type === 'polygon') {
        drawnItems.addLayer(layer);

        // Enregistrer le polygone
        document.getElementById('polygonForm').addEventListener('submit', async (event) => {
          event.preventDefault();
          const polygonName = document.getElementById('polygonName').value;
          const geoJsonData = layer.toGeoJSON();

          try {
            const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: polygonName, polygone: geoJsonData.geometry }),
            });

            if (response.ok) {
              alert('Polygone enregistré avec succès.');
            } else {
              console.error('Erreur lors de l\'enregistrement du polygone');
            }
          } catch (error) {
            console.error('Erreur de connexion au serveur pour enregistrer le polygone:', error);
          }
        });
      }
    });
  }
});
