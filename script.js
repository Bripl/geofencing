// Vérifier le titre de la page pour savoir de quelle page il s'agit
const pageTitle = document.title; // "Draw Polygon" ou "Show GPS Points"

// Initialisation de la carte Leaflet
const map = L.map('map').setView([48.8566, 2.3522], 12); // Centré sur Paris avec un zoom de 12

// Ajouter les tuiles OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

// Si on est sur la page pour dessiner des polygones
if (pageTitle === "Draw Polygon") {
  // Initialisation du contrôle de dessin
  const drawnItems = new L.FeatureGroup().addTo(map); // Groupe pour contenir les objets dessinés
  const drawControl = new L.Control.Draw({
    edit: {
      featureGroup: drawnItems, // La fonctionnalité de modification affecte le groupe "drawnItems"
    },
    draw: {
      polygon: true, // Autoriser le dessin de polygones
      rectangle: false, // Désactiver les rectangles
      circle: false, // Désactiver les cercles
      marker: false, // Désactiver les marqueurs
      polyline: false, // Désactiver les polylignes
    },
  }).addTo(map);

  // Écouter l'événement de fin de dessin
  map.on('draw:created', async function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer); // Ajouter le polygone au groupe

    const polygonCoordinates = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]); // Convertir en format [longitude, latitude]

    // Envoyer le polygone à Supabase
    await savePolygonToDatabase(polygonCoordinates);

    // Ajouter une popup pour afficher le polygone
    layer.bindPopup('Polygone dessiné').openPopup();
  });

  // Fonction pour enregistrer le polygone dans Supabase
  async function savePolygonToDatabase(polygonCoordinates) {
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/api/save-geofencing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        polygone: {
          type: 'Polygon',
          coordinates: [polygonCoordinates], // Format GeoJSON
        }
      }),
    });

    if (response.ok) {
      console.log('Polygone enregistré avec succès dans Supabase');
    } else {
      console.error('Erreur lors de l\'enregistrement du polygone');
    }
  }

} else if (pageTitle === "Show GPS Points") {
  // Si on est sur la page d'affichage des points GPS
  async function fetchAndDisplayPoints() {
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/GPS'); // URL pour récupérer les données GPS

    if (!response.ok) {
      console.error('Erreur lors de la récupération des points GPS:', response.statusText);
      return;
    }

    const data = await response.json();

    data.forEach(gpsData => {
      const latLng = [gpsData.latitude, gpsData.longitude]; // Extrait les coordonnées GPS
      const marker = L.marker(latLng).addTo(map);

      marker.bindPopup(`Point GPS: ${gpsData.device_id}`).openPopup();
    });
  }

  // Appeler la fonction pour récupérer et afficher les points GPS
  fetchAndDisplayPoints();
}
