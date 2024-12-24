document.addEventListener('DOMContentLoaded', async () => {
  const map = L.map('map').setView([48.8566, 2.3522], 12); // Paris par défaut
  console.log('Carte Leaflet initialisée avec succès.');

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Récupération des polygones depuis le backend
  try {
    const polygons = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des polygones.');
        }
        return response.json();
      });

    console.log('Polygones reçus du backend :', polygons);

    polygons.forEach((poly) => {
      const latlngs = poly.polygon.coordinates[0].map((coord) => [coord[1], coord[0]]);
      console.log('Coordonnées converties :', latlngs);
      L.polygon(latlngs, { color: 'blue' }).addTo(map).bindPopup(poly.name);
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des polygones:', error);
  }

  // Initialisation des outils de dessin Leaflet
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: {
      polygon: true,
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
    },
    edit: {
      featureGroup: drawnItems,
    },
  });
  map.addControl(drawControl);

  // Fonction pour enregistrer un polygone dans le backend
  async function savePolygon(layer, polygonName) {
    try {
      if (!polygonName) {
        alert('Veuillez entrer un nom pour le polygone.');
        return;
      }

      const geojson = layer.toGeoJSON();
      console.log('GeoJSON généré pour le polygone :', geojson);

      const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: polygonName, polygon: geojson }),
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(errorMessage || "Erreur lors de l'enregistrement du polygone.");
      }

      alert('Polygone enregistré avec succès');
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du polygone:", error);
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
      alert("Polygone ignoré car aucun nom n'a été fourni.");
      drawnItems.removeLayer(layer);
    }
  });

  // Gestion des polygones pour "Manage Geofencing Polygons"
  const polygonsListContainer = document.getElementById('polygons-list');

  async function fetchPolygons() {
    try {
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

  window.activatePolygon = async function (polygonId) {
    try {
      const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/activate-geofencing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: polygonId }),
      });

      if (response.ok) {
        alert('Polygone activé avec succès.');
        fetchPolygons();
      } else {
        console.error("Erreur lors de l'activation du polygone.");
      }
    } catch (error) {
      console.error("Erreur lors de l'activation du polygone:", error);
    }
  };

  window.deletePolygon = async function (polygonId) {
    try {
      const response = await fetch(`https://geofencing-8a9755fd6a46.herokuapp.com/API/delete-geofencing/${polygonId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Polygone supprimé avec succès.');
        fetchPolygons();
      } else {
        console.error("Erreur lors de la suppression du polygone.");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression du polygone:", error);
    }
  };

  fetchPolygons();
});



  // --- Gestion des points GPS pour 'Show GPS Points' ---
  if (pageTitle === 'Show GPS Points') {
    async function fetchGPSData() {
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/GPS');
        if (response.ok) {
          const data = await response.json();
          if (data.length === 0) {
            alert('Aucun point GPS disponible.');
          } else {
            displayGPSPoints(data);
          }
        } else {
          console.error('Erreur lors de la récupération des points GPS');
        }
      } catch (error) {
        console.error('Erreur de connexion au serveur:', error);
      }
    }

    function displayGPSPoints(points) {
      points.forEach(point => {
        const { latitude, longitude } = point;
        if (latitude && longitude) {
          // Vérification si les coordonnées sont valides avant d'ajouter le marqueur
          const lat = parseFloat(latitude);
          const lon = parseFloat(longitude);

          if (!isNaN(lat) && !isNaN(lon)) {
            const marker = L.marker([lat, lon]).addTo(map);
            marker.bindPopup(`
              <b>Device ID:</b> ${point.device_id} <br>
              <b>Timestamp:</b> ${point.timestamp} <br>
              <b>Geo-fence Status:</b> ${point.geofencing_status ? 'Entrée' : 'Sortie'}
            `);
          } else {
            console.warn(`Coordonnées invalides pour le point GPS : ${latitude}, ${longitude}`);
          }
        } else {
          console.warn(`Les coordonnées GPS manquent pour le point: ${JSON.stringify(point)}`);
        }
      });
    }

    fetchGPSData();
  }
});
