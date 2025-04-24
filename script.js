// Définir l'URL de base de votre backend
const API_BASE_URL = 'https://geofencing-8a9755fd6a46.herokuapp.com';
console.log("API_BASE_URL:", API_BASE_URL);

/* 
Fonction générique pour effectuer des requêtes AJAX vers le backend.
Utilisée partout dans le script.
*/
async function fetchData(url, method = 'GET', body = null) {
  console.log("fetchData appelé avec:", url, method, body);
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

/* 
Fonction pour mettre à jour une assignation.
Les actions sont définies comme suit :
 1 = activé
 2 = désactivé
 3 = supprimé
La fonction récupère, si disponible, le sélecteur d'heure (pour les actions 1 et 2),
puis transmet le payload (action, polygon_id et hour) à l’endpoint update-assignment.
*/
async function updateAssignmentWithHour(device_id, polygon_id, action) {
  const hourSelector = document.getElementById(`activation-hour-${device_id}-${polygon_id}`);
  // Pour l'action 3 (supprimé), aucun sélecteur d'heure n'est fourni, on utilise 0 par défaut.
  const selectedHour = hourSelector ? parseInt(hourSelector.value, 10) : 0;
  console.log(`updateAssignmentWithHour appelée avec device_id=${device_id}, polygon_id=${polygon_id}, action=${action}, heure=${selectedHour}`);
  
  const payload = {
    action,         // 1 = activé, 2 = désactivé, 3 = supprimé
    polygon_id,
    hour: selectedHour, // Valeur entre 0 et 48 (48 signifie "immediate")
    device_id,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/API/update-assignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    console.log('Réponse de mise à jour avec heure :', result);
    
    let actionText;
    if (action === 1) actionText = 'Activer';
    else if (action === 2) actionText = 'Désactiver';
    else if (action === 3) actionText = 'Supprimer';
    
    alert(`Action envoyée avec succès : ${actionText}, Heure : ${selectedHour === 48 ? 'Immédiate' : selectedHour}`);
    
    if (typeof fetchPolygons === 'function') {
      fetchPolygons();
    } else {
      console.warn("fetchPolygons n'est pas défini.");
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'assignation avec heure :', error);
    alert('Erreur lors de la mise à jour.');
  }
}

// Exposer globalement updateAssignmentWithHour pour être utilisé via onclick
window.updateAssignmentWithHour = updateAssignmentWithHour;

/* ---------------------------------------------------------------------
   GESTION DES POLYGONES POUR LA PAGE manage-geofencing.html
--------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('manage-geofencing-map')) {
    // Créer la carte pour la gestion des assignations
    const map = L.map('manage-geofencing-map').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Fonction pour charger et afficher les polygones depuis l'API /API/get-geofences
    async function fetchPolygons() {
      try {
        const geofences = await fetchData(API_BASE_URL + '/API/get-geofences');
        console.log("Polygones reçus:", geofences);
        // Optionnel: effacer tous les calques autres que le tileLayer pour renouveler la vue
        map.eachLayer(layer => {
          if (layer.options && layer.options.attribution && layer.options.attribution.includes('OpenStreetMap')) return;
          map.removeLayer(layer);
        });
        // Réajouter le tileLayer si nécessaire
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        
        geofences.forEach(geofence => {
          // Conversion des coordonnées GeoJSON en coordonnées Leaflet ([lat, lon])
          const leafletCoordinates = geofence.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
          const polygon = L.polygon(leafletCoordinates, {
            color: geofence.active ? 'green' : 'red',
          }).addTo(map);
          polygon.bindPopup(`<strong>Polygone :</strong> ${geofence.name}`);
          
          // Au clic sur le polygone, récupérer les assignations associées
          polygon.on('click', async () => {
            try {
              // On s'assure que polygon_id est du même type que dans la BDD
              const polygonIdParam = geofence.polygon_id; // vérifiez ici si c'est un nombre ou une chaîne
              const assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${polygonIdParam}`);
              console.log("Assignments pour le polygone :", geofence.name, assignments);
              let assignmentInfo = `<strong>Polygone :</strong> ${geofence.name}<br><strong>Nodes associés :</strong><ul>`;
              assignments.forEach(assignment => {
                // Construction d'un sélecteur pour choisir l'heure (0 à 47 pour des demi-heures, 48 pour immédiat)
                const hourOptions = Array.from({ length: 49 }, (_, i) => {
                  if (i === 48) return `<option value="${i}">Immédiat</option>`;
                  const hours = Math.floor(i / 2);
                  const minutes = (i % 2) * 30;
                  return `<option value="${i}">${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}</option>`;
                }).join('');
                assignmentInfo += `
                  <li>
                    Device : ${assignment.device_id} - Actif : ${assignment.active ? 'Oui' : 'Non'}
                    <select id="activation-hour-${assignment.device_id}-${geofence.polygon_id}">
                      ${hourOptions}
                    </select>
                    <button onclick="updateAssignmentWithHour('${assignment.device_id}', ${geofence.polygon_id}, ${assignment.active ? 2 : 1})">
                      ${assignment.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onclick="updateAssignmentWithHour('${assignment.device_id}', ${geofence.polygon_id}, 3)">
                      Supprimer
                    </button>
                  </li>`;
              });
              assignmentInfo += '</ul>';
              polygon.bindPopup(assignmentInfo).openPopup();
            } catch (error) {
              console.error("Erreur lors de la récupération des assignments :", error);
              polygon.bindPopup(`<strong>Erreur :</strong> Impossible de récupérer les informations du polygone.`).openPopup();
            }
          });
        });
      } catch (error) {
        console.error("Erreur lors du chargement des polygones :", error);
      }
    }
    
    // Charger les polygones dès l'initialisation
    fetchPolygons();
    
    // Exposer globalement fetchPolygons pour que updateAssignmentWithHour puisse y accéder
    window.fetchPolygons = fetchPolygons;
  }
});

/* ---------------------------------------------------------------------
   GESTION DU POLYGONE POUR LA PAGE draw_geofencing.html
   (Utilisé pour tracer un polygone et l'envoyer de manière segmentée)
--------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('geofencing-map')) {
    const map = L.map('geofencing-map').setView([48.8566, 2.3522], 13);
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
    
    // Charger les nodes pour remplir le select de la page draw_geofencing
    async function loadNodes() {
      try {
        const nodes = await fetchData(API_BASE_URL + '/API/get-nodes');
        console.log("Nodes récupérés :", nodes);
        const nodeSelectElem = document.getElementById('node-select');
        if (nodeSelectElem) {
          nodeSelectElem.innerHTML = "";
          nodes.forEach(node => {
            const option = document.createElement('option');
            // Assumez que la colonne "id" ou "device_id" contient l'identifiant
            option.value = node.id || node.device_id;
            // Affichez un libellé pertinent (ex. "Nom", "id", etc.)
            option.text = node.name || node.nom || node.id;
            nodeSelectElem.appendChild(option);
          });
        } else {
          console.warn("L'élément #node-select est introuvable sur la page draw_geofencing.");
        }
      } catch (error) {
        console.error("Erreur lors du chargement des nodes :", error);
      }
    }
    // Charger dès l'initialisation de draw_geofencing
    loadNodes();
    
    document.getElementById('save-polygon').addEventListener('click', () => {
      const polygonName = document.getElementById('polygon-name').value;
      const nodeSelect = document.getElementById('node-select');
      // Récupération des device_id sélectionnés
      const selectedNodes = Array.from(nodeSelect.selectedOptions).map(option => option.value);
      
      if (drawnPolygon && polygonName && selectedNodes.length > 0) {
        const polygonData = {
          name: polygonName,
          geometry: drawnPolygon.toGeoJSON().geometry,
          active: false,
          nodes: selectedNodes  // Pour la segmentation downlink
        };
        console.log("Envoi du polygone avec nodes:", polygonData);
        fetchData(API_BASE_URL + '/API/save-geofencing', 'POST', polygonData)
          .then(response => {
            console.log('Réponse du backend:', response);
            response ? alert('Polygone enregistré avec succès!') : alert('Insertion réussie sans retour de données.');
          })
          .catch(error => {
            console.error("Erreur lors de l'enregistrement du polygone:", error);
          });
      } else {
        alert('Veuillez tracer un polygone, entrer un nom et sélectionner au moins un node.');
      }
    });
  }
});
