// Définir l'URL de base de votre backend
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
Les actions sont définies :
 1 = activer, 2 = désactiver, 3 = supprimer.
*/
async function updateAssignmentWithHour(device_id, polygon_id, action) {
  const hourSelector = document.getElementById(`activation-hour-${device_id}-${polygon_id}`);
  // Pour l'action 3 (supprimer), aucun sélecteur d'heure n'est utilisé, on prend 0 par défaut.
  const selectedHour = hourSelector ? parseInt(hourSelector.value, 10) : 0;
  console.log(`updateAssignmentWithHour appelée avec device_id=${device_id}, polygon_id=${polygon_id}, action=${action}, heure=${selectedHour}`);
  
  const payload = {
    action,         // 1 = activer, 2 = désactiver, 3 = supprimer
    polygon_id,
    hour: selectedHour, // Valeur entre 0 et 48 (48 = "immédiate")
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
      fetchPolygons(); // Actualiser l'affichage
    } else {
      console.warn("fetchPolygons n'est pas défini.");
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'assignation avec heure :', error);
    alert('Erreur lors de la mise à jour.');
  }
}
window.updateAssignmentWithHour = updateAssignmentWithHour;

/* ---------------------------------------------------------------------
   GESTION DES POLYGONES POUR LA PAGE manage-geofencing.html
--------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('manage-geofencing-map')) {
    // Initialiser la carte
    const map = L.map('manage-geofencing-map').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Stocker globalement les polygones récupérés pour pouvoir les réutiliser (pour assignation)
    window.globalGeofences = [];

    async function fetchPolygons() {
      try {
        const geofences = await fetchData(API_BASE_URL + '/API/get-geofences');
        console.log("Polygones reçus:", geofences);
        window.globalGeofences = geofences; // stocker globalement
        
        // Effacer les calques existants sauf la couche de base
        map.eachLayer(layer => {
          if (layer.options && layer.options.attribution && layer.options.attribution.includes('OpenStreetMap')) return;
          map.removeLayer(layer);
        });
        // Réajouter la couche de fond
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        
        geofences.forEach(geofence => {
          // Conversion GeoJSON -> coordonnées Leaflet ([lat, lng])
          const leafletCoordinates = geofence.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
          const polygon = L.polygon(leafletCoordinates, {
            color: geofence.active ? 'green' : 'red',
          }).addTo(map);
          
          // Créer un popup contenant : le nom, un bouton de suppression et un module d'assignation
          const popupContent = `
            <strong>Polygone :</strong> ${geofence.name} (ID: ${geofence.polygon_id})<br>
            <button onclick="deleteUnusedPolygon(${geofence.polygon_id})">
              Supprimer le polygone s'il n'est pas assigné
            </button>
            <br><br>
            <strong>Assigner à un Node :</strong><br>
            <select id="node-select-${geofence.polygon_id}">
              <option value="gps-test">gps-test</option>
              <option value="device2">device2</option>
              <!-- Ajoutez d'autres options de device ici -->
            </select>
            <button onclick="assignPolygonToNode(${geofence.polygon_id})">
              Assigner ce polygone
            </button>
          `;
          polygon.bindPopup(popupContent);
          
          // Si l'on clique sur le polygone, on affiche également la liste des assignations existantes
          polygon.on('click', async () => {
            try {
              const assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${geofence.polygon_id}`);
              console.log("Assignments pour le polygone :", geofence.name, assignments);
              let assignmentInfo = `<strong>Polygone :</strong> ${geofence.name} (ID: ${geofence.polygon_id})<br>
                                    <strong>Nodes assignés :</strong><ul>`;
              assignments.forEach(assignment => {
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
              console.error("Erreur lors de la récupération des assignations :", error);
              polygon.bindPopup(`<strong>Erreur :</strong> Impossible de récupérer les informations du polygone.`).openPopup();
            }
          });
        });
      } catch (error) {
        console.error("Erreur lors du chargement des polygones :", error);
      }
    }
    
    fetchPolygons();
    window.fetchPolygons = fetchPolygons;
  }
});

/* ----------------------------------------------------------------------------
   FONCTIONS POUR SUPPRESSION ET ASSIGNATION
----------------------------------------------------------------------------- */

// Supprimer un polygone depuis geofences si aucune assignation n'existe dans polygon_assignments
async function deleteUnusedPolygon(polygon_id) {
  try {
    const response = await fetch(`${API_BASE_URL}/API/delete-unused-polygon`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygon_id })
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      if (typeof fetchPolygons === 'function') {
        fetchPolygons();
      }
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error("Erreur lors de la suppression du polygone :", error);
    alert("Erreur lors de la suppression du polygone.");
  }
}

// Assigner un polygone existant à un node (lancer la segmentation)
// Ici, on appelle l'endpoint /API/save-geofencing qui, s'il détecte un polygone existant,
// lance directement le processus de segmentation pour le node spécifié.
async function assignPolygonToNode(polygon_id) {
  const nodeSelect = document.getElementById(`node-select-${polygon_id}`);
  const device_id = nodeSelect.value;
  // Récupérer le polygone depuis la variable globale
  const geofences = window.globalGeofences || [];
  const polygon = geofences.find(g => g.polygon_id == polygon_id);
  if (!polygon) {
    alert("Polygone non trouvé dans la liste.");
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/API/save-geofencing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: polygon.name,
        geometry: polygon.geometry,
        nodes: [device_id] // On assigne ce polygone à ce node
      }),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      if (typeof fetchPolygons === 'function') {
        fetchPolygons();
      }
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error("Erreur lors de l'assignation du polygone :", error);
    alert("Erreur lors de l'assignation du polygone.");
  }
}


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
			// Utiliser node.device_id comme valeur
			option.value = node.device_id;
			// Afficher "name (device_id)" par exemple
			option.text = `${node.name || node.nom || node.device_id} (${node.device_id})`;
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
