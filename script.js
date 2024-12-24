document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.title;

  // Initialisation de la carte
  const mapElement = document.getElementById('map');
  if (mapElement) {
    const map = L.map(mapElement).setView([48.8566, 2.3522], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  }

  // --- Gestion du dessin de polygones pour 'Draw Polygon' ---
  if (pageTitle === 'Draw Polygon') {
    const drawnItems = new L.FeatureGroup().addTo(map);

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
    }).addTo(map);

    map.on(L.Draw.Event.CREATED, async function (event) {
      const layer = event.layer;
      drawnItems.addLayer(layer);

      // Extraire les coordonnées du polygone
      const polygonCoordinates = layer.toGeoJSON().geometry.coordinates;

      // Demander à l'utilisateur de saisir un nom pour le polygone
      const polygonName = prompt('Entrez le nom du polygone:');
      if (polygonName) {
        // Enregistrer le polygone dans Supabase (en s'assurant que Supabase est défini)
        if (typeof supabase !== 'undefined') {
          const { data, error } = await supabase
            .from('geofencing')
            .insert([{
              name: polygonName,
              polygon: polygonCoordinates,
              active: true, // On peut initialiser à "actif" ou selon les besoins
            }]);

          if (error) {
            console.error('Erreur lors de l\'enregistrement du polygone:', error);
          } else {
            alert('Polygone enregistré avec succès !');
          }
        } else {
          console.error('Supabase non défini');
        }
      } else {
        alert('Le nom du polygone est requis.');
      }
    });
  }

  // --- Gestion des polygones pour 'Manage Geofencing Polygons' ---
  if (pageTitle === 'Manage Geofencing Polygons') {
    const polygonsListContainer = document.getElementById('polygons-list');
    const drawnItems = new L.FeatureGroup().addTo(map);

    async function fetchPolygons() {
      // Affichage d'un message de chargement
      polygonsListContainer.innerHTML = '<p>Chargement des polygones...</p>';

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
      polygonsListContainer.innerHTML = ''; // Réinitialiser la liste des polygones

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
          const geoJsonLayer = L.geoJSON(polygon.polygon, {
            onEachFeature: (feature, layer) => {
              // Ajouter un popup pour chaque polygone
              layer.bindPopup(`
                <b>Nom:</b> ${polygonName} <br>
                <b>Status:</b> ${polygon.active ? 'Actif' : 'Inactif'} <br>
                <button onclick="activatePolygon('${polygon.id}', ${polygon.active})">${polygon.active ? 'Désactiver' : 'Activer'}</button>
                <button onclick="deletePolygon('${polygon.id}')">Supprimer</button>
              `);
            }
          }).addTo(map);
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
          fetchPolygons();  // Réactualise la liste des polygones
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
          fetchPolygons();  // Réactualise la liste des polygones
        } else {
          console.error('Erreur lors de la suppression du polygone');
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du polygone:', error);
      }
    };

    fetchPolygons();  // Charger les polygones au démarrage
  }

  // --- Gestion des points GPS pour 'Show GPS Points' ---
  if (pageTitle === 'Show GPS Points') {
    async function fetchGPSData() {
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/GPS');
        if (response.ok) {
          const data = await response.json();
          console.log(data); // Afficher les données récupérées pour vérifier la structure
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
        const marker = L.marker([latitude, longitude]).addTo(map);

        // Ajouter un popup pour chaque point
        marker.bindPopup(`
          <b>Device ID:</b> ${point.device_id} <br>
          <b>Timestamp:</b> ${point.timestamp} <br>
          <b>Geo-fence Status:</b> ${point.geo_fence_status}
        `);
      });
    }

    fetchGPSData();  // Charger les points GPS au démarrage
  }
});
