document.addEventListener('DOMContentLoaded', () => {
  // Définir l'URL de base de votre backend
  const API_BASE_URL = 'https://geofencing-8a9755fd6a46.herokuapp.com';

  // Fonction pour gérer les requêtes AJAX vers le backend
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

  // -------------------------------
  // GESTION DU POLYGONE (draw_geofencing.html, manage_geofencing.html, show_gps_points.html)
  // -------------------------------
  
  // Si un élément "geofencing-map" existe, initialiser la carte
  if (document.getElementById('geofencing-map')) {
    const map = L.map('geofencing-map').setView([48.8566, 2.3522], 13); // Paris par défaut

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Groupe pour ajouter les polygones dessinés
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Contrôles de dessin pour ajouter des polygones
    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: true,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
      },
    });
    map.addControl(drawControl);

    // Lorsqu'un polygone est dessiné
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
          active: false // Par défaut inactif
        };

        fetchData(API_BASE_URL + '/API/save-geofencing', 'POST', polygonData)
          .then(response => {
            console.log('Réponse du backend:', response);
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
  }

  // -------------------------------
  // GESTION DES DEVICES (add-device.html)
  // -------------------------------
  
  // Si le formulaire "device-form" existe, gérer son envoi
  if (document.getElementById('device-form')) {
    document.getElementById('device-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const device_id = document.getElementById('device_id').value.trim();
      const name = document.getElementById('name').value.trim();
      const payload = { device_id, name };

      try {
        const response = await fetchData(API_BASE_URL + '/API/add-device', 'POST', payload);
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
          resultDiv.innerHTML = `<p style="color: green;">${response.message}</p>`;
          document.getElementById('device-form').reset();
        }
      } catch (error) {
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
          resultDiv.innerHTML = `<p style="color: red;">Erreur: ${error.message}</p>`;
        }
      }
    });
  }
});
