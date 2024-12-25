document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM fully loaded and parsed');
  if (document.getElementById('map')) {
    console.log('Initializing map and draw controls');
    initializeMapAndDraw();
  }
  if (document.getElementById('polygons-list')) {
    console.log('Fetching polygons list');
    await fetchPolygonsList();
  }
  if (document.getElementById('gps-points')) {
    console.log('Fetching GPS points');
    await fetchGPSPoints();
  }
});

// Fonction pour initialiser la carte et le contrôle de dessin
function initializeMapAndDraw() {
  console.log('Calling initializeMap');
  const map = initializeMap();
  console.log('Calling initializeDrawControl');
  const drawnItems = initializeDrawControl(map);
  console.log('Calling fetchPolygons');
  fetchPolygons(map);
  console.log('Setting up draw events');
  handleDrawEvents(map, drawnItems);
  console.log('Setting up edit events');
  handleEditEvents(map, drawnItems);
}

function initializeMap() {
  console.log('Initializing map');
  const map = L.map('map').setView([48.8566, 2.3522], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  console.log('Map initialized');
  return map;
}

function initializeDrawControl(map) {
  console.log('Initializing draw control');
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: { polygon: true, polyline: false, rectangle: false, circle: false, marker: false },
    edit: { featureGroup: drawnItems },
  });
  map.addControl(drawControl);
  console.log('Draw control initialized');

  return drawnItems;
}

function handleDrawEvents(map, drawnItems) {
  console.log('Setting up draw event handlers');
  map.on('draw:created', async (event) => {
    const layer = event.layer;
    drawnItems.addLayer(layer);

    const polygonName = prompt('Entrez un nom pour ce polygone :');
    if (polygonName) {
      console.log(`Saving polygon: ${polygonName}`);
      await savePolygon(layer, polygonName);
    } else {
      alert('Polygone ignoré car aucun nom n\'a été fourni.');
      drawnItems.removeLayer(layer);
    }
  });
}

function handleEditEvents(map, drawnItems) {
  console.log('Setting up edit and delete event handlers');
  map.on('draw:edited', async (event) => {
    const layers = event.layers;
    layers.eachLayer(async (layer) => {
      const polygonId = layer.feature?.properties?.id;
      const polygonName = prompt('Modifiez le nom pour ce polygone :', layer.feature?.properties?.name || '');
      if (polygonId && polygonName) {
        console.log(`Updating polygon: ${polygonName}`);
        await updatePolygon(polygonId, layer, polygonName);
      }
    });
  });

  map.on('draw:deleted', async (event) => {
    const layers = event.layers;
    layers.eachLayer(async (layer) => {
      const polygonId = layer.feature?.properties?.id;
      if (polygonId) {
        console.log(`Deleting polygon with ID: ${polygonId}`);
        await deletePolygon(polygonId);
      }
    });
  });
}

async function fetchPolygons(map) {
  try {
    console.log('Fetching polygons from backend');
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
    if (!response.ok) throw new Error('Erreur lors de la récupération des polygones.');

    const polygons = await response.json();
    polygons.forEach((poly) => addPolygonToMap(map, poly));
    console.log('Polygons fetched and added to map');
  } catch (error) {
    console.error('Erreur lors de la récupération des polygones :', error);
  }
}

function addPolygonToMap(map, poly) {
  const latlngs = poly.Polygon.coordinates[0].map((coord) => [coord[1], coord[0]]); // Conversion [lon, lat] -> [lat, lon]
  const layer = L.polygon(latlngs, { color: 'blue' })
    .addTo(map)
    .bindPopup(poly.name || 'Polygone sans nom');
  layer.feature = { properties: { id: poly.id, name: poly.name } };
  console.log(`Polygon added: ${poly.name}`);
}

async function savePolygon(layer, polygonName) {
  try {
    const geojson = layer.toGeoJSON();
    geojson.geometry.coordinates = geojson.geometry.coordinates.map((ring) =>
      ring.map((coord) => [coord[1], coord[0]]) // Inverser [lat, lon] -> [lon, lat]
    );
    geojson.properties = { name: polygonName };
    console.log('GeoJSON à envoyer :', JSON.stringify(geojson, null, 2));

    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: polygonName, Polygon: geojson }),
    });

    if (!response.ok) throw new Error(await response.text());
    alert('Polygone enregistré avec succès.');
    console.log('Polygon saved successfully');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du polygone :', error);
    alert('Erreur lors de l\'enregistrement du polygone.');
  }
}

async function updatePolygon(polygonId, layer, polygonName) {
  try {
    const geojson = layer.toGeoJSON();
    geojson.geometry.coordinates = geojson.geometry.coordinates.map((ring) =>
      ring.map((coord) => [coord[1], coord[0]]) // Inverser [lat, lon] -> [lon, lat]
    );
    geojson.properties = { name: polygonName };
    console.log('GeoJSON à envoyer :', JSON.stringify(geojson, null, 2));

    const response = await fetch(`https://geofencing-8a9755fd6a46.herokuapp.com/API/update-geofencing/${polygonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: polygonName, Polygon: geojson }),
    });

    if (!response.ok) throw new Error(await response.text());
    alert('Polygone mis à jour avec succès.');
    console.log('Polygon updated successfully');
  } catch (error) {
    console.error('Erreur lors de la mise à jour du polygone :', error);
    alert('Erreur lors de la mise à jour du polygone.');
  }
}

async function deletePolygon(polygonId) {
  try {
    console.log(`Deleting polygon with ID: ${polygonId}`);
    const response = await fetch(`https://geofencing-8a9755fd6a46.herokuapp.com/API/delete-geofencing/${polygonId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error(await response.text());
    alert('Polygone supprimé avec succès.');
    console.log('Polygon deleted successfully');
  } catch (error) {
    console.error('Erreur lors de la suppression du polygone :', error);
    alert('Erreur lors de la suppression du polygone.');
  }
}

async function activatePolygon(polygonId) {
  try {
    console.log(`Activating polygon with ID: ${polygonId}`);
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/activate-geofencing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: polygonId }),
    });

    if (!response.ok) throw new Error(await response.text());
    alert('Polygone activé avec succès.');
    console.log('Polygon activated successfully');
  } catch (error) {
    console.error('Erreur lors de l\'activation du polygone :', error);
    alert('Erreur lors de l\'activation du polygone.');
  }
}

async function fetchPolygonsList() {
  try {
    console.log('Fetching polygons list from backend');
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
    if (!response.ok) throw new Error('Erreur lors de la récupération des polygones.');

    const polygons = await response.json();
    const polygonsList = document.getElementById('polygons-list');
    polygonsList.innerHTML = ''; // Clear the previous content

    polygons.forEach((poly) => {
      const polygonItem = document.createElement('div');
      polygonItem.className = 'polygon-item';
      polygonItem.innerHTML = `
        <span>${poly.name}</span>
        <button onclick="activatePolygon('${poly.id}')">Activer</button>
        <button onclick="deletePolygon('${poly.id}')">Supprimer</button>
      `;
      polygonsList.appendChild(polygonItem);
    });
    console.log('Polygons list fetched and displayed');
  } catch (error) {
	      console.error('Erreur lors de la récupération de la liste des polygones :', error);
    alert('Erreur lors de la récupération de la liste des polygones.');
  }
}