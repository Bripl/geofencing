document.addEventListener('DOMContentLoaded', async () => {
  // Initialisation de la carte Leaflet
  const map = L.map('map').setView([48.8566, 2.3522], 12); // Paris par défaut
  console.log('Carte Leaflet initialisée avec succès.');

  // Ajouter la couche OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Récupérer les polygones depuis le backend
  try {
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des polygones.');
    }
    const polygons = await response.json();
    console.log('Polygones reçus du backend :', polygons);

    // Ajouter les polygones sur la carte
    polygons.forEach((poly) => {
      const latlngs = poly.polygon.coordinates[0].map((coord) => [coord[1], coord[0]]);
      console.log('Coordonnées converties :', latlngs);
      L.polygon(latlngs, { color: 'blue' }).addTo(map).bindPopup(poly.name);
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des polygones:', error);
  }

  // Initialisation du contrôle de dessin Leaflet
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: { polygon: true, polyline: false, rectangle: false, circle: false, marker: false },
    edit: { featureGroup: drawnItems }
  });
  map.addControl(drawControl);

  // Fonction pour enregistrer un polygone dans le backend
  async function savePolygon(layer, polygonName) {
  try {
    if (!polygonName) {
      alert('Veuillez entrer un nom pour le polygone.');
      return;
    }

    // Convertir le polygone en GeoJSON
    const geojson = layer.toGeoJSON();
    geojson.properties = { name: polygonName };

    console.log("GeoJSON généré pour le polygone :", geojson);

    // Assurez-vous que le GeoJSON est un objet valide de type "Feature"
    if (geojson.type !== 'Feature' || geojson.geometry.type !== 'polygon') {
      alert("Le format du GeoJSON est incorrect.");
      return;
    }

    // Préparer la requête pour enregistrer le polygone
    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: polygonName,
        polygon: geojson  // Envoi du GeoJSON avec le nom du polygone
      })
    });

    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(errorMessage || "Erreur lors de l'enregistrement du polygone.");
    }

    alert('Polygone enregistré avec succès');
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du polygone :", error);
    alert("Erreur lors de l'enregistrement du polygone.");
  }
}


  // Gestion des événements de dessin
  map.on('draw:created', (event) => {
    const layer = event.layer;
    drawnItems.addLayer(layer);

    const polygonName = prompt('Entrez un nom pour ce polygone :');
    console.log('Nom du polygone saisi :', polygonName);
    if (polygonName) {
      savePolygon(layer, polygonName);
    } else {
      alert('Polygone ignoré car aucun nom n\'a été fourni.');
      drawnItems.removeLayer(layer);
    }
  });

  // Récupérer et afficher les polygones existants
  async function fetchPolygons() {
  try {
    const polygonsListContainer = document.getElementById('polygons-list');
    if (!polygonsListContainer) {
      console.error("Le conteneur des polygones n'a pas été trouvé.");
      return;
    }

    const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
    console.log('Réponse brute:', response);
    if (response.ok) {
      const data = await response.json();
      console.log('Polygones récupérés:', data);
      displayPolygons(data);
    } else {
      polygonsListContainer.innerHTML = '<p>Erreur lors de la récupération des polygones.</p>';
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des polygones:', error);
  }
}

  function displayPolygons(polygons) {
    const polygonsListContainer = document.getElementById('polygons-list');
    polygonsListContainer.innerHTML = '';
    polygons.forEach((poly) => {
      const polygonName = poly.name || 'Polygone sans nom';

      const polygonItem = document.createElement('div');
      polygonItem.className = 'polygon-item';
      polygonItem.innerHTML = `
        <span>Nom: ${polygonName}</span>
        <button onclick="activatePolygon('${poly.id}')">Activer</button>
        <button onclick="deletePolygon('${poly.id}')">Supprimer</button>
      `;
      polygonsListContainer.appendChild(polygonItem);
    });
  }

  // Activer un polygone
  window.activatePolygon = async function (polygonId) {
    try {
      const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/activate-geofencing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: polygonId })
      });

      if (response.ok) {
        alert('Polygone activé avec succès.');
        fetchPolygons();
      } else {
        console.error('Erreur lors de l\'activation du polygone.');
      }
    } catch (error) {
      console.error('Erreur lors de l\'activation du polygone:', error);
    }
  };

  // Supprimer un polygone
  window.deletePolygon = async function (polygonId) {
    try {
      const response = await fetch(`https://geofencing-8a9755fd6a46.herokuapp.com/API/delete-geofencing/${polygonId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Polygone supprimé avec succès.');
        fetchPolygons();
      } else {
        console.error('Erreur lors de la suppression du polygone.');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du polygone:', error);
    }
  };

  // Appel initial pour charger les polygones
  fetchPolygons();
});