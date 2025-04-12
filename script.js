document.addEventListener('DOMContentLoaded', () => {
  // Fonction pour gérer les requêtes AJAX
  async function fetchData(url, method = 'GET', body = null) {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP! Statut: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return null;
  }

  // Initialisation de la carte
  const map = L.map('geofencing-map').setView([48.8566, 2.3522], 13); // Paris par défaut

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  // Groupe pour ajouter les polygones dessinés
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  // Contrôles de dessin pour ajouter des polygones
  const drawControl = new L.Control.Draw({
    edit: {
      featureGroup: drawnItems,
    },
    draw: {
      polygon: true,
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
    },
  });
  map.addControl(drawControl);

  // Lorsque le polygone est dessiné
  let drawnPolygon = null;
  map.on(L.Draw.Event.CREATED, function (event) {
    drawnItems.clearLayers();
    drawnPolygon = event.layer;
    drawnItems.addLayer(drawnPolygon);
  });

  // Enregistrer le polygone
  document.getElementById('save-polygon').addEventListener('click', () => {
    const polygonName = document.getElementById('polygon-name').value;

    if (drawnPolygon && polygonName) {
      const polygonData = {
        name: polygonName,
        geometry: drawnPolygon.toGeoJSON().geometry,
        active: false // Définir par défaut comme inactif
      };

      // Envoi des données du polygone à un backend via POST
      fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', 'POST', polygonData)
        .then(response => {
          console.log('Réponse du backend:', response); // Affichage des logs de réponse pour le débogage
          if (response) {
            alert('Polygone enregistré avec succès!');
          } else {
            alert('Insertion réussie sans retour de données.');
          }
        })
        .catch(error => {
          console.error('Erreur lors de l\'enregistrement du polygone:', error);
        });
    } else {
      alert('Veuillez tracer un polygone et entrer un nom.');
    }
  });
});
