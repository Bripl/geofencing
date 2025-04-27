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
  if (document.getElementById('manage-geofencing-map')) {
    // Créer la carte
    const map = L.map('manage-geofencing-map').setView([48.8566, 2.3522], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    // Création du sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    sidebar.style.cssText = "float:left; width:30%; height:600px; overflow-y:auto; padding:10px; border:1px solid #ccc;";
    document.body.insertBefore(sidebar, document.getElementById('manage-geofencing-map'));
    
    const mapContainer = document.getElementById('manage-geofencing-map');
    mapContainer.style.cssText = "float:right; width:70%; height:600px;";
    
    // Stockage global des polygones
    window.globalGeofences = [];
    
    // Récupérer et afficher les polygones
    async function fetchPolygons() {
      try {
        const geofences = await fetchData(API_BASE_URL + '/API/get-geofences');
        console.log("Polygones reçus:", geofences);
        window.globalGeofences = geofences;
        // Pour chaque polygone, créer un calque sur la carte et stocker le layer dans l'objet
        geofences.forEach(geofence => {
          const leafletCoordinates = geofence.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
          const polygonLayer = L.polygon(leafletCoordinates, { color: geofence.active ? 'green' : 'red' });
          polygonLayer.addTo(map);
          geofence.layer = polygonLayer;
          // Si on clique sur le polygone, on le sélectionne dans le sidebar
          polygonLayer.on('click', () => selectPolygon(geofence));
        });
        renderPolygonList(geofences);
      } catch (err) {
        console.error("Erreur lors du chargement des polygones :", err);
      }
    }
    
    // Afficher la liste des polygones dans le sidebar (colonne de gauche)
    function renderPolygonList(geofences) {
      const polygonListDiv = document.createElement('div');
      polygonListDiv.id = 'polygonList';
      polygonListDiv.innerHTML = "<h3>Polygones</h3>";
      const ul = document.createElement('ul');
      geofences.forEach(geo => {
        const li = document.createElement('li');
        li.textContent = `${geo.name} (ID: ${geo.polygon_id})`;
        li.style.cursor = "pointer";
        li.addEventListener('click', () => selectPolygon(geo));
        ul.appendChild(li);
      });
      polygonListDiv.appendChild(ul);
      sidebar.appendChild(polygonListDiv);
    }
    
    // Quand un polygone est sélectionné, afficher les assignations
    async function selectPolygon(geofence) {
      // Nettoyer la section d'assignation existante
      let assignSection = document.getElementById('assignSection');
      if (assignSection) assignSection.remove();
      assignSection = document.createElement('div');
      assignSection.id = 'assignSection';
      assignSection.innerHTML = `<h3>Polygone: ${geofence.name} (ID: ${geofence.polygon_id})</h3>`;
      
      try {
        // Récupérer les assignations pour ce polygone
        const assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${geofence.polygon_id}`);
        // Récupérer la liste complète des nodes
        const nodes = await fetchData(`${API_BASE_URL}/API/get-nodes`);
        // Séparer ceux assignés et non assignés
        const assignedNodes = nodes.filter(n => assignments.find(a => a.device_id === n.device_id));
        const unassignedNodes = nodes.filter(n => !assignments.find(a => a.device_id === n.device_id));
        
        // Afficher les nodes assignés
        let assignedDiv = document.createElement('div');
        assignedDiv.innerHTML = "<h4>Nodes assignés</h4>";
        if (assignedNodes.length > 0) {
          const ulAssigned = document.createElement('ul');
          assignedNodes.forEach(node => {
            const li = document.createElement('li');
            li.textContent = node.name || node.device_id;
            // Vous pouvez ajouter des boutons d'action ici (activer, désactiver, supprimer)
            ulAssigned.appendChild(li);
          });
          assignedDiv.appendChild(ulAssigned);
        } else {
          assignedDiv.innerHTML += "<p>Aucun node assigné</p>";
        }
        assignSection.appendChild(assignedDiv);
        
        // Afficher les nodes disponibles avec cases à cocher (multi-selection)
        let availableDiv = document.createElement('div');
        availableDiv.innerHTML = "<h4>Nodes disponibles</h4>";
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
            // Mettre à jour l'affichage des assignations
            selectPolygon(geofence);
          });
          form.appendChild(btnAssign);
          availableDiv.appendChild(form);
        } else {
          availableDiv.innerHTML += "<p>Tous les nodes sont assignés</p>";
        }
        assignSection.appendChild(availableDiv);
        
        // Afficher la section d'assignation dans le sidebar
        sidebar.appendChild(assignSection);
        
        // Mettre en surbrillance le polygone sur la carte (ex: changer sa couleur en bleu)
        if (geofence.layer) {
          geofence.layer.setStyle({ color: "blue" });
        }
      } catch (err) {
        console.error("Erreur lors de la sélection du polygone :", err);
      }
    }
    
    fetchPolygons();
    window.fetchPolygons = fetchPolygons;
    
    // Optionnel : Si vous voulez aussi une liste des nodes en parallèle pour afficher leurs assignations,
    // vous pouvez ajouter une section "Nodes" dans le sidebar et définir un événement de clic pour chaque node.
    
  }
});

/* ============================
   SECTION : Page draw_geofencing.html
   (Création de polygones sans sélection de nodes)
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('geofencing-map')) {
    // Ici, on initialise la carte pour la page draw.
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
    
    // Supprimer toute trace de sélection de nodes
    // (Assurez-vous que l'HTML pour draw_geofencing.html ne contient pas de <select id="node-select">)
    
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
      
      // Préparer uniquement name et geometry
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
