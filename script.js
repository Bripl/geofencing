document.addEventListener('DOMContentLoaded', () => {
  // Définir l'URL de base de votre backend
  const API_BASE_URL = 'https://geofencing-8a9755fd6a46.herokuapp.com';
  console.log("API_BASE_URL:", API_BASE_URL);

  // Fonction pour gérer les requêtes AJAX vers le backend
  async function fetchData(url, method = 'GET', body = null) {
    console.log("fetchData appelé avec:", url, method, body);
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    console.log("Réponse reçue avec le status:", response.status);

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
  // Chargement des nodes pour le select (dans draw_geofencing.html)
  // -------------------------------
  if (document.getElementById('node-select')) {
    console.log("Chargement des nodes...");
    fetchData(API_BASE_URL + '/API/get-nodes')
      .then(data => {
        console.log("Nodes reçus:", data);
        const select = document.getElementById('node-select');
        // Pour chaque node, on crée une option dans le select
        data.forEach(node => {
          let option = document.createElement("option");
          option.value = node.device_id; // on utilise device_id pour identifier le node
          option.text = `${node.name} (${node.device_id})`;
          select.appendChild(option);
        });
      })
      .catch(error => {
        console.error("Erreur lors du chargement des nodes:", error);
      });
  }

  // -------------------------------
  // GESTION DU POLYGONE pour draw_geofencing.html (et pages similaires)
  // -------------------------------
  
  if (document.getElementById('geofencing-map')) {
    const map = L.map('geofencing-map').setView([48.8566, 2.3522], 13); // Paris par défaut

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

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

    let drawnPolygon = null;
    map.on(L.Draw.Event.CREATED, function (event) {
      drawnItems.clearLayers();
      drawnPolygon = event.layer;
      drawnItems.addLayer(drawnPolygon);
    });

    document.getElementById('save-polygon').addEventListener('click', () => {
      const polygonName = document.getElementById('polygon-name').value;
      const nodeSelect = document.getElementById('node-select');
      // Récupération des device_id sélectionnés dans le select
      const selectedNodes = Array.from(nodeSelect.selectedOptions).map(option => option.value);
      
      // On vérifie qu'un polygone a bien été dessiné, qu'un nom est fourni et qu'au moins un node est sélectionné
      if (drawnPolygon && polygonName && selectedNodes.length > 0) {
        const polygonData = {
          name: polygonName,
          geometry: drawnPolygon.toGeoJSON().geometry,
          active: false,
          nodes: selectedNodes  // Ajout de la propriété nodes pour la segmentation downlink
        };
        console.log("Envoi du polygone avec nodes:", polygonData);
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
            console.error("Erreur lors de l'enregistrement du polygone:", error);
          });
      } else {
        alert('Veuillez tracer un polygone, entrer un nom et sélectionner au moins un node.');
      }
    });
  }

  // -------------------------------
  // GESTION DES DEVICES pour add-device.html
  // -------------------------------
  if (document.getElementById('device-form')) {
    document.getElementById('device-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const device_id = document.getElementById('device_id').value.trim();
      const name = document.getElementById('name').value.trim();
      const payload = { device_id, name };
      console.log("Envoi du device:", payload);

      try {
        const response = await fetchData(API_BASE_URL + '/API/add-device', 'POST', payload);
        console.log("Réponse pour l'ajout du device:", response);
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
        console.error("Erreur lors de l'ajout du device:", error);
      }
    });
  }
});
