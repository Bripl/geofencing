document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.title;

  // Initialisation de la carte
  const map = L.map('map').setView([48.8566, 2.3522], 12); // Paris par défaut
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Initialisation du Supabase client
  const supabase = supabase.createClient(
    process.env.SUPABASE_URL, // Utilisation de la variable d'environnement SUPABASE_URL
    process.env.SUPABASE_API_KEY // Utilisation de la variable d'environnement SUPABASE_API_KEY
  );

  // Initialisation des outils de dessin Leaflet
  const drawControl = new L.Control.Draw({
    draw: {
      polygon: true,
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false
    },
    edit: {
      featureGroup: new L.FeatureGroup().addTo(map)
    }
  });
  map.addControl(drawControl);

  // Fonction pour enregistrer un polygone dans Supabase
  async function savePolygon(polygon, polygonName) {
    try {
      // Validation du nom du polygone
      if (!polygonName) {
        alert('Veuillez entrer un nom pour le polygone.');
        return;
      }

      // Convertir les coordonnées du polygone en format GeoJSON
      const geojson = polygon.toGeoJSON();

      // Envoi des données à Supabase
      const { data, error } = await supabase
        .from('geofencing')
        .insert([{
          name: polygonName,
          polygon: geojson
        }]);

      if (error) {
        console.error('Erreur lors de l\'enregistrement du polygone:', error);
        alert('Erreur lors de l\'enregistrement du polygone');
      } else {
        alert('Polygone enregistré avec succès');
        console.log('Polygone enregistré:', data);
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du polygone:', error);
      alert('Erreur de connexion à Supabase');
    }
  }

  // Événement de soumission du formulaire
  const polygonForm = document.getElementById('polygonForm');
  polygonForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const polygonName = document.getElementById('polygonName').value;
    const drawnPolygon = drawControl.options.edit.featureGroup.getLayers()[0]; // Récupérer le dernier polygone dessiné

    if (drawnPolygon && polygonName) {
      savePolygon(drawnPolygon, polygonName);
      drawnPolygon.remove(); // Effacer le polygone après l'enregistrement
    } else {
      alert('Veuillez dessiner un polygone et lui donner un nom');
    }
  });

  // Gestion des dessins sur la carte
  map.on('draw:created', (event) => {
    const layer = event.layer;
    drawControl.options.edit.featureGroup.addLayer(layer);
  });

  // --- Gestion des polygones pour 'Manage Geofencing Polygons' ---
  if (pageTitle === 'Manage Geofencing Polygons') {
    const polygonsListContainer = document.getElementById('polygons-list');

    async function fetchPolygons() {
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
        if (response.ok) {
          const data = await response.json();
          if (data.length === 0) {
            polygonsListContainer.innerHTML = '<p>Aucun polygone disponible.</p>';
          } else {
            displayPolygons(data);
          }
        } else {
          polygonsListContainer.innerHTML = '<p>Erreur lors de la récupération des polygones.</p>';
          console.error('Erreur lors de la récupération des polygones');
        }
      } catch (error) {
        polygonsListContainer.innerHTML = '<p>Erreur de connexion au serveur.</p>';
        console.error('Erreur lors de la récupération des polygones:', error);
      }
    }

    function displayPolygons(polygons) {
      polygonsListContainer.innerHTML = '';

      polygons.forEach(polygon => {
        const polygonName = polygon.name || 'Polygone sans nom';

        // Créer un item pour chaque polygone
        const polygonItem = document.createElement('div');
        polygonItem.className = 'polygon-item';

        polygonItem.innerHTML = `
          <span>Nom: ${polygonName}</span>
          <button onclick="activatePolygon('${polygon.id}', ${polygon.active})">${polygon.active ? 'Désactiver' : 'Activer'}</button>
          <button onclick="deletePolygon('${polygon.id}')">Supprimer</button>
        `;

        // Ajouter le polygone sur la carte
        if (polygon.polygon && polygon.polygon.type === 'Polygon') {
          const geoJsonLayer = L.geoJSON(polygon.polygon).addTo(map);
        } else {
          console.error(`Données de polygone non valides pour l'ID ${polygon.id}`);
        }

        polygonsListContainer.appendChild(polygonItem);
      });
    }

    // Fonction pour activer ou désactiver un polygone
    window.activatePolygon = async function (polygonId, currentStatus) {
      const newStatus = !currentStatus;  // Inverser le statut (active -> inactive et vice versa)
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/activate-geofencing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: polygonId, active: newStatus }),
        });

        if (response.ok) {
          alert(newStatus ? 'Polygone activé avec succès.' : 'Polygone désactivé avec succès.');
          fetchPolygons();
        } else {
          console.error('Erreur lors de l\'activation du polygone');
        }
      } catch (error) {
        console.error('Erreur lors de l\'activation du polygone:', error);
      }
    };

    // Fonction pour supprimer un polygone
    window.deletePolygon = async function (polygonId) {
      try {
        const response = await fetch(`https://geofencing-8a9755fd6a46.herokuapp.com/API/delete-geofencing/${polygonId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          alert('Polygone supprimé avec succès.');
          fetchPolygons();
        } else {
          console.error('Erreur lors de la suppression du polygone');
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du polygone:', error);
      }
    };

    fetchPolygons();
  }

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
