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

    let currentPolygon = null; // Pour suivre le polygone actuel

    map.on('draw:created', function (event) {
      // Supprime le polygone précédent si un nouveau est dessiné
      drawnItems.clearLayers();
      currentPolygon = event.layer;
      drawnItems.addLayer(currentPolygon);
    });

    // Gestion du formulaire d'envoi des polygones
    const polygonForm = document.getElementById('polygonForm');
    polygonForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!currentPolygon) {
        alert('Veuillez dessiner un polygone avant de l\'enregistrer.');
        return;
      }

      const polygonName = document.getElementById('polygonName').value;
      const polygonCoordinates = currentPolygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);

      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: polygonName,
            polygone: {
              type: 'Polygon',
              coordinates: [polygonCoordinates],
            },
          }),
        });

        if (response.ok) {
          alert('Polygone enregistré avec succès');
          polygonForm.reset();
          drawnItems.clearLayers();
          currentPolygon = null;
        } else {
          const errorMessage = await response.text();
          console.error('Erreur lors de l\'enregistrement du polygone:', errorMessage);
          alert('Erreur lors de l\'enregistrement du polygone.');
        }
      } catch (error) {
        console.error('Erreur lors de la requête:', error);
        alert('Une erreur est survenue lors de la sauvegarde du polygone.');
      }
    });

  } else if (pageTitle === 'Show GPS Points') {
    // Fonctionnalités pour afficher les points GPS
    async function fetchGPSData() {
      try {
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
      } catch (error) {
        console.error('Erreur lors de la récupération des points GPS:', error);
      }
    }

    fetchGPSData();
  }
});
