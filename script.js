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
Fonction pour mettre à jour une assignation (actions : activer, désactiver, supprimer).
*/
async function updateAssignmentWithHour(device_id, polygon_id, action) {
  const hourSelector = document.getElementById(`activation-hour-${device_id}-${polygon_id}`);
  const selectedHour = hourSelector ? parseInt(hourSelector.value, 10) : 0;
  console.log(`updateAssignmentWithHour appelée avec device_id=${device_id}, polygon_id=${polygon_id}, action=${action}, heure=${selectedHour}`);
  
  const payload = {
    action,    // 1 = activer, 2 = désactiver, 3 = supprimer
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
    let actionText = (action === 1) ? 'Activer' : (action === 2) ? 'Désactiver' : 'Supprimer';
    alert(`Action envoyée avec succès : ${actionText}, Heure : ${selectedHour === 48 ? 'Immédiate' : selectedHour}`);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'assignation :', error);
    alert('Erreur lors de la mise à jour.');
  }
}
window.updateAssignmentWithHour = updateAssignmentWithHour;

/* ============================
   SECTION : Page manage_geofencing.html
=============================== */
document.addEventListener('DOMContentLoaded', () => {
  // On vérifie que les éléments 'map-container' et 'sidebar' existent bien
  if (document.getElementById('map-container') && document.getElementById('sidebar')) {
    // Initialiser la carte dans le conteneur.
    const map = L.map('map-container').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Référence de la sidebar
    const sidebar = document.getElementById('sidebar');
    
    // Stocker globalement les polygones
    window.globalGeofences = [];
    
    async function fetchPolygons() {
      try {
        // Récupérer la liste de tous les polygones
        let geofences = await fetchData(API_BASE_URL + '/API/get-geofences');
        console.log("Polygones reçus:", geofences);
        
        // Pour chaque polygone, vérifier s'il a au moins une assignation
        // en appelant l'endpoint get-polygon-assignments
        geofences = await Promise.all(
          geofences.map(async (geofence) => {
            const assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${geofence.polygon_id}`);
            // Attribuer true s'il y a au moins une assignation, false sinon
            geofence.assigned = (assignments && assignments.length > 0);
            return geofence;
          })
        );
        
        window.globalGeofences = geofences;
        
        // Purger les anciennes couches (mais pas le tileLayer)
        map.eachLayer(layer => {
          if (layer.options && layer.options.attribution && layer.options.attribution.includes('OpenStreetMap'))
            return;
          map.removeLayer(layer);
        });
        // Réajouter le tileLayer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        
        // Effacer le contenu de la sidebar et y ajouter un titre
        sidebar.innerHTML = "<h3>Polygones</h3>";
        
        // Pour chaque polygone, ajouter un élément dans la sidebar et un calque sur la carte.
        geofences.forEach(geofence => {
          // La couleur de base dépend du statut assigné :
          // - Rouge si assigné (au moins une assignation)
          // - Vert sinon.
          const baseColor = geofence.assigned ? 'red' : 'green';
          
          // Création d'un élément pour la liste dans la sidebar
          const pItem = document.createElement('div');
          pItem.style.cursor = 'pointer';
          pItem.style.marginBottom = '5px';
          pItem.textContent = `${geofence.name} (ID: ${geofence.polygon_id})`;
          pItem.addEventListener('click', () => selectPolygon(geofence, map, sidebar));
          sidebar.appendChild(pItem);
          
          // Création du calque sur la carte
          const leafletCoordinates = geofence.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
          const polygonLayer = L.polygon(leafletCoordinates, { color: baseColor });
          polygonLayer.addTo(map);
          geofence.layer = polygonLayer;
          polygonLayer.on('click', () => selectPolygon(geofence, map, sidebar));
        });
      } catch (err) {
        console.error("Erreur lors du chargement des polygones :", err);
      }
    }
    
    async function selectPolygon(geofence, map, sidebar) {
      // Réinitialiser la couleur de tous les polygones en fonction de leur statut assigné
      window.globalGeofences.forEach(g => {
        if (g.layer) {
          const color = g.assigned ? 'red' : 'green';
          g.layer.setStyle({ color: color });
        }
      });
      
      // Mettre en surbrillance le polygone sélectionné en bleu
      if (geofence.layer) {
        geofence.layer.setStyle({ color: "blue" });
      }
      
      // Créer ou rafraîchir la zone d'assignation dans la sidebar
      let assignSection = document.getElementById('assignSection');
      if (assignSection) {
        assignSection.remove();
      }
      assignSection = document.createElement('div');
      assignSection.id = 'assignSection';
      assignSection.style.marginTop = '20px';
      assignSection.innerHTML = `<h3>Polygone: ${geofence.name} (ID: ${geofence.polygon_id})</h3>`;
      
      try {
        // Récupérer les assignations pour ce polygone
        const assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${geofence.polygon_id}`);
        // Récupérer la liste complète des nodes
        const nodes = await fetchData(`${API_BASE_URL}/API/get-nodes`);
        
        // Section assignées
        let assignedDiv = document.createElement('div');
        assignedDiv.innerHTML = "<h4>Nodes assignés</h4>";
        if (assignments && assignments.length > 0) {
          const ulAssigned = document.createElement('ul');
          assignments.forEach(assignment => {
            // Chercher les infos complémentaires sur le node
            const nodeInfo = nodes.find(n => n.device_id === assignment.device_id) || {};
            const li = document.createElement('li');
            li.innerHTML = `
              Device: ${nodeInfo.name || assignment.device_id} - Actif: ${assignment.active ? 'Oui' : 'Non'}
              <br>
              <select id="activation-hour-${assignment.device_id}-${geofence.polygon_id}">
                ${Array.from({ length: 49 }, (_, i) => {
                  if (i === 48) return `<option value="${i}">Immédiat</option>`;
                  const hours = Math.floor(i / 2);
                  const minutes = (i % 2) * 30;
                  return `<option value="${i}">${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}</option>`;
                }).join('')}
              </select>
              <button onclick="updateAssignmentWithHour('${assignment.device_id}', ${geofence.polygon_id}, ${assignment.active ? 2 : 1})">
                ${assignment.active ? 'Désactiver' : 'Activer'}
              </button>
              <button onclick="updateAssignmentWithHour('${assignment.device_id}', ${geofence.polygon_id}, 3)">
                Supprimer
              </button>
            `;
            ulAssigned.appendChild(li);
          });
          assignedDiv.appendChild(ulAssigned);
        } else {
          assignedDiv.innerHTML += "<p>Aucun node assigné</p>";
        }
        assignSection.appendChild(assignedDiv);
        
        // Section nodes disponibles (non assignées)
        let availableDiv = document.createElement('div');
        availableDiv.innerHTML = "<h4>Nodes disponibles</h4>";
        const unassignedNodes = nodes.filter(n => !assignments || !assignments.find(a => a.device_id === n.device_id));
        if (unassignedNodes.length > 0) {
          const form = document.createElement('form');
          unassignedNodes.forEach(node => {
            const label = document.createElement('label');
            label.style.display = "block";
            const checkbox = document.createElement('input');
            checkbox.type = "checkbox";
            checkbox.value = node.device_id;
            label.appendChild(checkbox);
            label.append(" " + (node.name || node.device_id));
            form.appendChild(label);
          });
          const btnAssign = document.createElement('button');
          btnAssign.type = "button";
          btnAssign.textContent = "Assigner les nodes sélectionnés";
          btnAssign.addEventListener('click', async () => {
            const selected = Array.from(form.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
            for (const d_id of selected) {
              try {
                const response = await fetch(`${API_BASE_URL}/API/assign-geofence`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ polygon_id: geofence.polygon_id, device_id: d_id })
                });
                const result = await response.json();
                console.log(result.message);
              } catch (err) {
                console.error(err);
              }
            }
            // Rafraîchir la zone d'assignation après modifications
            selectPolygon(geofence, map, sidebar);
          });
          form.appendChild(btnAssign);
          availableDiv.appendChild(form);
        } else {
          availableDiv.innerHTML += "<p>Tous les nodes sont assignés</p>";
        }
        assignSection.appendChild(availableDiv);
        // Ajouter (ou remplacer) la zone d'assignation dans la sidebar
        sidebar.appendChild(assignSection);
      } catch (err) {
        console.error("Erreur dans selectPolygon :", err);
      }
    }
    
    fetchPolygons();
    window.fetchPolygons = fetchPolygons;
  }
});

/* ===============================
   SECTION : Page draw-geofencing.html
   (Création simple de polygones sans sélection de nodes)
============================== */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('geofencing-map')) {
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
    
    // Pas de sélection de nodes sur cette page
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
      }
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
      if (!drawnPolygon || !polygonName) {
        alert('Veuillez tracer un polygone et entrer un nom.');
        return;
      }
      
      // Envoyer uniquement name et geometry à l'endpoint /API/create-geofence
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

