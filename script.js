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
  // Vérifier que les conteneurs 'map-container' et 'sidebar' existent
  if (document.getElementById('map-container') && document.getElementById('sidebar')) {
    // Initialiser la carte dans le conteneur "map-container"
    const map = L.map('map-container').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Référence de la sidebar
    const sidebar = document.getElementById('sidebar');

    // Variables globales pour stocker les données
    window.globalGeofences = [];   // polygones (geofences)
    window.globalNodes = [];       // liste des nodes
    window.globalAssignments = []; // assignments au format { polygon_id, device_id, active }

    // --- Fonctions de récupération des données ---

    async function fetchAllPolygons() {
      try {
        let polys = await fetchData(API_BASE_URL + '/API/get-geofences');
        // Pour chaque polygone, on récupère ses assignations et on note s'il est assigné
        polys = await Promise.all(
          polys.map(async (poly) => {
            try {
              let assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${poly.polygon_id}`);
              poly.assigned = (assignments && assignments.length > 0);
              if (assignments && assignments.length > 0) {
                assignments.forEach(a => {
                  window.globalAssignments.push({
                    polygon_id: poly.polygon_id,
                    device_id: a.device_id,
                    active: a.active
                  });
                });
              }
            } catch (e) {
              poly.assigned = false;
            }
            return poly;
          })
        );
        window.globalGeofences = polys;
      } catch (e) {
        console.error("Erreur dans fetchAllPolygons : ", e);
      }
    }

    async function fetchAllNodes() {
      try {
        const nodes = await fetchData(API_BASE_URL + '/API/get-nodes');
        window.globalNodes = nodes;
      } catch (e) {
        console.error("Erreur dans fetchAllNodes : ", e);
      }
    }

    // --- Fonctions de rendu dans la sidebar ---

    // Afficher la liste des polygones avec leur couleur de base
    function renderPolygonList(map, sidebar) {
      let polygonListDiv = document.getElementById('polygonList');
      if (!polygonListDiv) {
        polygonListDiv = document.createElement('div');
        polygonListDiv.id = 'polygonList';
        polygonListDiv.innerHTML = "<h3>Polygones</h3>";
        sidebar.appendChild(polygonListDiv);
      } else {
        polygonListDiv.innerHTML = "<h3>Polygones</h3>";
      }

      window.globalGeofences.forEach(poly => {
        const div = document.createElement('div');
        div.style.cursor = 'pointer';
        div.style.marginBottom = '5px';
        // Couleur de base : rouge si assigné, vert sinon
        const baseColor = poly.assigned ? 'red' : 'green';
        div.style.color = baseColor;
        div.textContent = `${poly.name} (ID: ${poly.polygon_id})`;
        div.addEventListener('click', () => selectPolygon(poly, map, sidebar));
        polygonListDiv.appendChild(div);
      });
    }

    // Afficher la liste complète des nodes
    function renderNodeList(sidebar) {
      let nodeListDiv = document.getElementById('nodeList');
      if (!nodeListDiv) {
        nodeListDiv = document.createElement('div');
        nodeListDiv.id = 'nodeList';
        nodeListDiv.innerHTML = "<h3>Nodes</h3>";
        sidebar.appendChild(nodeListDiv);
      } else {
        nodeListDiv.innerHTML = "<h3>Nodes</h3>";
      }
      window.globalNodes.forEach(node => {
        const div = document.createElement('div');
        div.style.cursor = 'pointer';
        div.style.marginBottom = '5px';
        div.textContent = node.name || node.device_id;
        div.addEventListener('click', () => selectNode(node, map, sidebar));
        nodeListDiv.appendChild(div);
      });
    }

    // --- Fonctions de sélection ---

    // Lorsqu'on sélectionne un polygone
    async function selectPolygon(poly, map, sidebar) {
      // Réinitialiser la couleur de tous les polygones en fonction de leur statut de base
      window.globalGeofences.forEach(g => {
        if (g.layer) {
          const baseColor = g.assigned ? 'red' : 'green';
          g.layer.setStyle({ color: baseColor });
        }
      });
      // Mettre en surbrillance le polygone sélectionné en bleu
      if (poly.layer) {
        poly.layer.setStyle({ color: 'blue' });
      }

      // Créer ou renouveler la zone d'assignation pour le polygone
      let assignSection = document.getElementById('assignSection');
      if (assignSection) assignSection.remove();
      assignSection = document.createElement('div');
      assignSection.id = 'assignSection';
      assignSection.style.marginTop = '20px';
      assignSection.innerHTML = `<h3>Polygone: ${poly.name} (ID: ${poly.polygon_id})</h3>`;

      // Utiliser globalAssignments pour récupérer les assignations du polygone
      const assignmentsForPoly = window.globalAssignments.filter(a => a.polygon_id === poly.polygon_id);
      let assignedDiv = document.createElement('div');
      assignedDiv.innerHTML = "<h4>Nodes assignés</h4>";
      if (assignmentsForPoly.length > 0) {
        let ul = "<ul>";
        assignmentsForPoly.forEach(a => {
          const nodeInfo = window.globalNodes.find(n => n.device_id === a.device_id) || {};
          ul += `<li>Device: ${nodeInfo.name || a.device_id} - Actif: ${a.active ? 'Oui' : 'Non'} 
                   [<select id="activation-hour-${a.device_id}-${poly.polygon_id}">
                      ${Array.from({ length: 49 }, (_, i) => {
                        if (i === 48) return `<option value="${i}">Immédiat</option>`;
                        const hours = Math.floor(i / 2);
                        const minutes = (i % 2) * 30;
                        return `<option value="${i}">${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}</option>`;
                      }).join('')}
                   </select>
                   <button onclick="updateAssignmentWithHour('${a.device_id}', ${poly.polygon_id}, ${a.active ? 2 : 1})"> ${a.active ? 'Désactiver' : 'Activer'} </button>
                   <button onclick="updateAssignmentWithHour('${a.device_id}', ${poly.polygon_id}, 3)">Supprimer</button>]
                 </li>`;
        });
        ul += "</ul>";
        assignedDiv.innerHTML += ul;
      } else {
        assignedDiv.innerHTML += "<p>Aucune assignation</p>";
      }
      assignSection.appendChild(assignedDiv);

      // Pour les nodes disponibles, filtrer ceux sans assignation pour ce polygone
      const availableNodes = window.globalNodes.filter(n =>
        !window.globalAssignments.find(a => a.device_id === n.device_id && a.polygon_id === poly.polygon_id)
      );
      let availableDiv = document.createElement('div');
      availableDiv.innerHTML = "<h4>Nodes disponibles</h4>";
      if (availableNodes.length > 0) {
        let form = document.createElement('form');
        availableNodes.forEach(n => {
          const label = document.createElement('label');
          label.style.display = "block";
          const checkbox = document.createElement('input');
          checkbox.type = "checkbox";
          checkbox.value = n.device_id;
          label.appendChild(checkbox);
          label.append(" " + (n.name || n.device_id));
          form.appendChild(label);
        });
        const btnAssign = document.createElement('button');
        btnAssign.type = "button";
        btnAssign.textContent = "Assigner les nodes sélectionnés";
        btnAssign.addEventListener('click', async () => {
          const selected = Array.from(form.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
          for (const d_id of selected) {
            try {
              const resp = await fetch(`${API_BASE_URL}/API/assign-geofence`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ polygon_id: poly.polygon_id, device_id: d_id })
              });
              const resJson = await resp.json();
              console.log(resJson.message);
            } catch (err) {
              console.error(err);
            }
          }
          // Après assignation, recharger cette section
          selectPolygon(poly, map, sidebar);
        });
        form.appendChild(btnAssign);
        availableDiv.appendChild(form);
      } else {
        availableDiv.innerHTML += "<p>Tous les nodes sont assignés</p>";
      }
      assignSection.appendChild(availableDiv);
      // Ajouter la section d'assignation à la sidebar
      let existingSection = document.getElementById('assignSection');
      if (existingSection) existingSection.remove();
      sidebar.appendChild(assignSection);
    }

    // Lorsqu'on sélectionne un node depuis la liste des nodes dans la sidebar
    async function selectNode(node, map, sidebar) {
      // Réinitialiser les couleurs pour tous les polygones
      window.globalGeofences.forEach(poly => {
        if (poly.layer) {
          const baseColor = poly.assigned ? 'red' : 'green';
          poly.layer.setStyle({ color: baseColor });
        }
      });
      // Filtrer les assignations pour ce node
      const nodeAssignments = window.globalAssignments.filter(a => a.device_id === node.device_id);
      const assignedPolygonIds = nodeAssignments.map(a => a.polygon_id);
      // Mettre en surbrillance en bleu les polygones assignés à ce node
      window.globalGeofences.forEach(poly => {
        if (assignedPolygonIds.includes(poly.polygon_id) && poly.layer) {
          poly.layer.setStyle({ color: 'blue' });
        }
      });
      
      // Construire une section d'affichage pour les assignations du node
      let nodeAssignSection = document.getElementById('nodeAssignSection');
      if (nodeAssignSection) nodeAssignSection.remove();
      nodeAssignSection = document.createElement('div');
      nodeAssignSection.id = 'nodeAssignSection';
      nodeAssignSection.style.marginTop = '20px';
      nodeAssignSection.innerHTML = `<h3>Assignations pour le node: ${node.name || node.device_id}</h3>`;
      
      if (nodeAssignments && nodeAssignments.length > 0) {
        let html = "<ul>";
        nodeAssignments.forEach(a => {
          html += `<li>Polygone ID: ${a.polygon_id} - Actif: ${a.active ? 'Oui' : 'Non'}</li>`;
        });
        html += "</ul>";
        nodeAssignSection.innerHTML += html;
      } else {
        nodeAssignSection.innerHTML += "<p>Ce node n'a aucune assignation.</p>";
      }
      sidebar.appendChild(nodeAssignSection);
    }

    // Fonction d'initialisation globale
    async function init() {
      await fetchAllNodes();
      await fetchAllPolygons();
      // Afficher la liste des polygones et des nodes.
      renderPolygonList(map, sidebar);
      renderNodeList(sidebar);
    }
    init();
    
    // Exposer quelques fonctions globales si besoin.
    window.fetchPolygons = fetchAllPolygons;
    window.fetchNodes = fetchAllNodes;
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

