document.addEventListener('DOMContentLoaded', async () => {
  const map = initializeMap();
  const drawnItems = initializeDrawControl(map);
  await fetchPolygons(map);
  handleDrawEvents(map, drawnItems);
});

// Fonction pour initialiser la carte
function initializeMap() {
  const map = L.map('map').setView([48.8566, 2.3522], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  return map;
}

// Fonction pour initialiser le contrôle de dessin
function initializeDrawControl(map) {
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: { polygon: true, polyline: false, rectangle: false, circle: false, marker: false },
    edit: { featureGroup: drawnItems },
  });
  map.addControl(drawControl);

  return drawnItems;
}

// Gérer les événements de dessin
function handleDrawEvents(map, drawnItems) {
  map.on('draw:created', async (event) => {
    const layer = event.layer;
    drawnItems.addLayer(layer);

    const polygonName = prompt('Entrez un nom pour ce polygone :');
    if (polygonName) {
      await savePolygon(layer, polygonName);
    } else {
      alert('Polygone ignoré car aucun nom n\'a été fourni.');
      drawnItems.removeLayer(layer);
    }
  });
}

// Charger les polygones depuis le backend
async function fetchPolygons(map) {
  try {
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
    if (!response.ok) throw new Error('Erreur lors de la récupération des polygones.');

    const polygons = await response.json();
    polygons.forEach((poly) => addPolygonToMap(map, poly));
  } catch (error) {
    console.error('Erreur lors de la récupération des polygones :', error);
  }
}

// Ajouter un polygone à la carte
function addPolygonToMap(map, poly) {
  const latlngs = poly.Polygon.coordinates[0].map((coord) => [coord[1], coord[0]]); // Conversion [lon, lat] -> [lat, lon]
  L.polygon(latlngs, { color: 'blue' }).addTo(map).bindPopup(poly.name || 'Polygone sans nom');
}

// Enregistrer un polygone dans le backend
async function savePolygon(layer, polygonName) {
  try {
    // Obtenir le GeoJSON du polygone dessiné
    const geojson = layer.toGeoJSON();

    // Conversion des coordonnées au format [lon, lat] attendu par le backend
    geojson.geometry.coordinates = geojson.geometry.coordinates.map((ring) =>
      ring.map((coord) => [coord[1], coord[0]]) // Inverser [lat, lon] -> [lon, lat]
    );

    // Ajout des propriétés nécessaires
    geojson.properties = { name: polygonName };

    // Debug : afficher le GeoJSON pour vérifier sa structure
    console.log('GeoJSON à envoyer :', JSON.stringify(geojson, null, 2));

    // Requête au backend
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: polygonName, Polygon: geojson }),
    });

    if (!response.ok) throw new Error(await response.text());
    alert('Polygone enregistré avec succès.');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du polygone :', error);
    alert('Erreur lors de l\'enregistrement du polygone.');
  }
}

