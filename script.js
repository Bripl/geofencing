// Définir l'URL de base de votre backend
const API_BASE_URL = 'https://geofencing-8a9755fd6a46.herokuapp.com';
console.log("API_BASE_URL:", API_BASE_URL);

/* 
Fonction générique pour effectuer des requêtes AJAX vers le backend.
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
Fonction de mise à jour d'une assignation (pour les actions sur un device déjà assigné)
Actions : 1 = activer, 2 = désactiver, 3 = supprimer.
*/
async function updateAssignmentWithHour(device_id, polygon_id, action) {
  const hourSelector = document.getElementById(`activation-hour-${device_id}-${polygon_id}`);
  const selectedHour = hourSelector ? parseInt(hourSelector.value, 10) : 0;
  console.log(`updateAssignmentWithHour appelée avec device_id=${device_id}, polygon_id=${polygon_id}, action=${action}, heure=${selectedHour}`);
  
  const payload = {
    action,         // 1 = activer, 2 = désactiver, 3 = supprimer
    polygon_id,
    hour: selectedHour,
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
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'assignation avec heure :', error);
    alert('Erreur lors de la mise à jour.');
  }
}
window.updateAssignmentWithHour = updateAssignmentWithHour;


/* ---------------------------------------------------------
   SECTION : Gestion des polygones dans manage_geofencing.html
--------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Si nous sommes sur la page de gestion (existe un élément avec id 'manage-geofencing-map')
  if (document.getElementById('manage-geofencing-map')) {
    const map = L.map('manage-geofencing-map').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Stocker globalement les polygones récupérés
    window.globalGeofences = [];
    
    async function fetchPolygons() {
      try {
        const geofences = await fetchData(API_BASE_URL + '/API/get-geofences');
        console.log("Polygones reçus:", geofences);
        window.globalGeofences = geofences;
        
        // Effacer les calques existants sauf la couche de fond
        map.eachLayer(layer => {
          if (layer.options && layer.options.attribution && layer.options.attribution.includes('OpenStreetMap'))
            return;
          map.removeLayer(layer);
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        
        // Pour chaque polygone
        geofences.forEach(geofence => {
          // Construction du polygone Leaflet à partir de GeoJSON
          const leafletCoordinates = geofence.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
          const polygon = L.polygon(leafletCoordinates, {
            color: geofence.active ? 'green' : 'red'
          }).addTo(map);
          
          let popupContent = `<strong>Polygone :</strong> ${geofence.name} (ID: ${geofence.polygon_id})<br>
                              <button onclick="deleteUnusedPolygon(${geofence.polygon_id})">
                                Supprimer le polygone s'il n'est pas assigné
                              </button>
                              <br><br>`;
          
          // Récupérer les assignations existantes pour ce polygone
          fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${geofence.polygon_id}`)
          .then(assignments => {
            console.log("Assignments pour le polygone :", geofence.name, assignments);
            let infoHTML = `<strong>Nodes assignés :</strong><ul>`;
            assignments.forEach(assignment => {
              infoHTML += `<li>
                              Device : ${assignment.device_id} - Actif : ${assignment.active ? 'Oui' : 'Non'}
                              <br>
                              <select id="activation-hour-${assignment.device_id}-${geofence.polygon_id}">
                                ${Array.from({ length: 49 }, (_, i) => {
                                  if (i === 48) return `<option value="${i}">Immédiat</option>`;
                                  const hours = Math.floor(i / 2);
                                  const minutes = (i % 2) * 30;
                                  return `<option value="${i}">${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}</option>`;
                                }).join('')}
                              </select>
                              <button onclick="updateAssignmentWithHour('${assignment.device_id}', ${geofence.polygon_id}, ${assignment.active ? 2 : 1})">
                                ${assignment.active ? 'Désactiver' : 'Activer'}
                              </button>
                              <button onclick="updateAssignmentWithHour('${assignment.device_id}', ${geofence.polygon_id}, 3)">
                                Supprimer
                              </button>
                           </li>`;
            });
            infoHTML += '</ul>';
            
            // Charger la liste des nodes disponibles pour une nouvelle assignation
            fetchData(`${API_BASE_URL}/API/get-nodes`)
            .then(nodes => {
              // Filtrer pour ne proposer que les nodes non assignés pour ce polygone
              const assigned = assignments.map(a => a.device_id);
              const availableNodes = nodes.filter(n => !assigned.includes(n.device_id));
              let assignOptions = "";
              if (availableNodes.length > 0) {
                assignOptions = availableNodes.map(n => `<option value="${n.device_id}">${n.name || n.nom || n.device_id}</option>`).join('');
              }
              let assignHTML = availableNodes.length > 0
                        ? `<strong>Assigner ce polygone à un Node :</strong><br>
                           <select id="node-select-${geofence.polygon_id}">
                             ${assignOptions}
                           </select>
                           <button onclick="assignPolygonToNode(${geofence.polygon_id})">
                             Assigner ce polygone
                           </button>`
                        : `<strong>Tous les nodes sont déjà assignés.</strong>`;
              
              const fullPopup = popupContent + infoHTML + "<br>" + assignHTML;
              polygon.bindPopup(fullPopup);
              polygon.on('click', () => polygon.openPopup());
            })
            .catch(err => {
              console.error("Erreur lors du chargement des nodes pour assignation:", err);
            });
            
          })
          .catch(err => {
            console.error("Erreur lors de la récupération des assignations:", err);
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

/* ---------------------------------------------------------------------
   Fonctions de suppression et assignation pour manage_geofencing
--------------------------------------------------------------------- */

// Supprimer un polygone de geofences (si aucune assignation n'existe)
async function deleteUnusedPolygon(polygon_id) {
  try {
    const response = await fetch(`${API_BASE_URL}/API/delete-unused-polygon`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygon_id }),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      // Vous pouvez rafraîchir la liste après quelques secondes si souhaité.
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error("Erreur lors de la suppression du polygone :", error);
    alert("Erreur lors de la suppression du polygone.");
  }
}

// Assigner un polygone à un node via l'endpoint assign-geofence
async function assignPolygonToNode(polygon_id) {
  const nodeSelect = document.getElementById(`node-select-${polygon_id}`);
  if (!nodeSelect) {
    alert("Sélection de node introuvable.");
    return;
  }
  const device_id = nodeSelect.value;
  
  // Vérifier que le polygone est présent dans la liste globale
  const geofences = window.globalGeofences || [];
  const polygon = geofences.find(g => g.polygon_id == polygon_id);
  if (!polygon) {
    alert("Polygone non trouvé dans la liste.");
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/API/assign-geofence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Envoyer uniquement polygon_id et device_id (la géométrie est récupérée côté back)
      body: JSON.stringify({
        polygon_id: polygon.polygon_id,
        device_id
      }),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      // Vous pouvez rafraîchir la liste des assignations après un délai si nécessaire.
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error("Erreur lors de l'assignation du polygone :", error);
    alert("Erreur lors de l'assignation du polygone.");
  }
}

/* ---------------------------------------------------------
   SECTION : Gestion du polygone dans draw_geofencing.html
   (Création & Enregistrement dans geofences uniquement)
--------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('geofencing-map')) {
    // Si la carte n'est pas encore initialisée
    let map;
    const mapContainer = document.getElementById('geofencing-map');
    if (!mapContainer._leaflet_id) {
      map = L.map('geofencing-map').setView([48.8566, 2.3522], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
    } else {
      map = L.map('geofencing-map');
    }
    
    // Groupe de calques pour le polygone dessiné
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Ajout du contrôle de dessin
    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: {
        polygon: true,
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false
      }
    });
    map.addControl(drawControl);
    
    let drawnPolygon = null;
    map.on(L.Draw.Event.CREATED, function (event) {
      drawnItems.clearLayers();
      drawnPolygon = event.layer;
      drawnItems.addLayer(drawnPolygon);
    });
    
    // Bouton d'enregistrement (utilise l'endpoint create-geofence)
    document.getElementById('save-polygon').addEventListener('click', () => {
      const polygonName = document.getElementById('polygon-name').value;
      if (!drawnPolygon || !polygonName) {
        alert('Veuillez tracer un polygone et entrer un nom.');
        return;
      }
      
      // Préparer les données à envoyer : uniquement name et geometry
      const polygonData = {
        name: polygonName,
        geometry: drawnPolygon.toGeoJSON().geometry
      };
      console.log("Envoi du polygone (draw):", polygonData);
      
      fetchData(API_BASE_URL + '/API/create-geofence', 'POST', polygonData)
        .then(response => {
          console.log('Réponse du backend (create-geofence):', response);
          alert('Polygone enregistré avec succès!');
        })
        .catch(error => {
          console.error("Erreur lors de l'enregistrement du polygone:", error);
          alert("Erreur lors de l'enregistrement du polygone.");
        });
    });
  }
});
