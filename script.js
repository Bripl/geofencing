// Initialisation de la carte Leaflet
const map = L.map('map').setView([48.8566, 2.3522], 12); // Centré sur Paris avec un zoom de 12

// Ajouter les tuiles OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Initialisation du contrôle de dessin
const drawnItems = new L.FeatureGroup().addTo(map); // Groupe pour contenir les objets dessinés
const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems, // La fonctionnalité de modification affecte le groupe "drawnItems"
  },
  draw: {
    polygon: true, // Autoriser le dessin de polygones
    rectangle: false, // Désactiver les rectangles (vous pouvez activer si nécessaire)
    circle: false, // Désactiver les cercles
    marker: false, // Désactiver les marqueurs
    polyline: false, // Désactiver les polylines
  },
});

map.addControl(drawControl); // Ajouter le contrôle de dessin sur la carte

// Écouter l'événement de fin de dessin
map.on('draw:created', async function (event) {
  console.log('Polygone créé');  // Vérifier si l'événement est bien déclenché
  const layer = event.layer;
  drawnItems.addLayer(layer); // Ajouter le polygone au groupe

  const polygonCoordinates = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]); // Convertir en format [longitude, latitude]

  // Envoyer le polygone à Supabase
  await savePolygonToDatabase(polygonCoordinates);

  // Ajouter une popup pour afficher le polygone
  layer.bindPopup('Polygone dessiné').openPopup();

  // Ajuste la vue de la carte pour englober tous les objets dessinés
  map.fitBounds(drawnItems.getBounds());
});

// Fonction pour enregistrer le polygone dans Supabase
async function savePolygonToDatabase(polygonCoordinates) {
  const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/api/save-geofencing', { // URL de votre endpoint
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      polygone: {
        type: 'Polygon',
        coordinates: [polygonCoordinates] // Format GeoJSON
      }
    }),
  });

  if (response.ok) {
    console.log('Polygone enregistré avec succès dans Supabase');
  } else {
    console.error('Erreur lors de l\'enregistrement du polygone');
  }
}

// Fonction pour récupérer et afficher les polygones depuis Supabase
async function fetchAndDisplayPolygons() {
  const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/api/geofencing'); // URL de votre backend pour récupérer les polygones

  if (!response.ok) {
    console.error('Erreur lors de la récupération des polygones:', response.statusText);
    return;
  }

  const data = await response.json();

  data.forEach(polygonData => {
    const latLngs = polygonData.polygone.coordinates[0].map(coord => [coord[1], coord[0]]);
    const polygon = L.polygon(latLngs, { color: 'red', fillColor: 'blue', fillOpacity: 0.3 }).addTo(map);

    polygon.bindPopup('Polygone enregistré');
  });
}

// Appeler la fonction pour afficher les polygones à partir de la base de données
fetchAndDisplayPolygons();
