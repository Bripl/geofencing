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
  // Vérifier que les conteneurs "map-container" et "sidebar" existent.
  const mapContainer = document.getElementById('map-container');
  const sidebar = document.getElementById('sidebar');
  if (!mapContainer || !sidebar) return;
  
  // Initialiser la carte dans "map-container"
  const map = L.map('map-container').setView([48.8566, 2.3522], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  
  // Global variables
  window.globalGeofences = [];   // Table de geofences
  window.globalNodes = [];       // Liste des nodes
  window.globalAssignments = []; // Format { polygon_id, device_id, active }
  
  // Fonction générique de récupération
  async function fetchData(url, method = 'GET', body = null) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
      throw new Error(`Erreur HTTP ! Statut: ${res.status}`);
    }
    return res.json();
  }
  
  // Récupérer tous les polygones et leurs assignations
  async function fetchAllPolygons() {
    try {
      let polys = await fetchData(API_BASE_URL + '/API/get-geofences');
      // Pour chaque polygone, on récupère ses assignations
      polys = await Promise.all(polys.map(async (poly) => {
        try {
          const assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${poly.polygon_id}`);
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
      }));
      window.globalGeofences = polys;
    } catch (e) {
      console.error("Erreur dans fetchAllPolygons:", e);
    }
  }
  
  // Récupérer tous les nodes
  async function fetchAllNodes() {
    try {
      const nodes = await fetchData(API_BASE_URL + '/API/get-nodes');
      window.globalNodes = nodes;
    } catch (e) {
      console.error("Erreur dans fetchAllNodes:", e);
    }
  }
  
  // Création des calques de polygones sur la carte
  function createPolygonLayers() {
    window.globalGeofences.forEach(poly => {
      const coords = poly.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
      // Couleur de base : rouge si assigné, sinon vert
      const baseColor = poly.assigned ? 'red' : 'green';
      const layer = L.polygon(coords, { color: baseColor }).addTo(map);
      poly.layer = layer;
      // Au clic sur le calque, sélectionner ce polygone.
      layer.on('click', () => selectPolygon(poly));
    });
  }
  
  // Rendu de la liste des polygones dans la sidebar (simple liste de noms)
  function renderPolygonList() {
    let polyListDiv = document.getElementById('polygonList');
    if (!polyListDiv) {
      polyListDiv = document.createElement('div');
      polyListDiv.id = 'polygonList';
      sidebar.appendChild(polyListDiv);
    }
    polyListDiv.innerHTML = "<h3>Polygones</h3>";
    window.globalGeofences.forEach(poly => {
      const div = document.createElement('div');
      div.style.cursor = 'pointer';
      div.style.marginBottom = '5px';
      // On n'applique pas la couleur sur le texte ici.
      div.textContent = `${poly.name} (ID: ${poly.polygon_id})`;
      div.addEventListener('click', () => selectPolygon(poly));
      polyListDiv.appendChild(div);
    });
  }
  
  // Rendu de la liste complète des nodes dans la sidebar
  function renderNodeList() {
    let nodeListDiv = document.getElementById('nodeList');
    if (!nodeListDiv) {
      nodeListDiv = document.createElement('div');
      nodeListDiv.id = 'nodeList';
      sidebar.appendChild(nodeListDiv);
    }
    nodeListDiv.innerHTML = "<h3>Nodes</h3>";
    window.globalNodes.forEach(node => {
      const div = document.createElement('div');
      div.style.cursor = 'pointer';
      div.style.marginBottom = '5px';
      div.textContent = node.name || node.device_id;
      // Au clic sur le node, on surlignera ses polygones assignés sur la carte.
      div.addEventListener('click', () => selectNode(node));
      nodeListDiv.appendChild(div);
    });
  }
  
  // Réinitialise la couleur de tous les polygones selon leur couleur de base
  function resetAllPolygonColors() {
    window.globalGeofences.forEach(poly => {
      if (poly.layer) {
        const baseColor = poly.assigned ? 'red' : 'green';
        poly.layer.setStyle({ color: baseColor });
      }
    });
  }
  
  // Gestion lorsqu'un polygone est sélectionné
  async function selectPolygon(poly) {
    resetAllPolygonColors();
    if (poly.layer) {
      poly.layer.setStyle({ color: 'blue' });
    }
  
    // Supprimer toute section d'assignation précédemment affichée
    const oldAssignSection = document.getElementById('assignSection');
    if (oldAssignSection) oldAssignSection.remove();
  
    const assignSection = document.createElement('div');
    assignSection.id = 'assignSection';
    assignSection.style.marginTop = '20px';
    assignSection.innerHTML = `<h3>Polygone: ${poly.name} (ID: ${poly.polygon_id})</h3>`;
  
    // Utiliser le tableau global des assignations pour ce polygone
    const assignmentsForPoly = window.globalAssignments.filter(a => a.polygon_id === poly.polygon_id);
    let assignedDiv = document.createElement('div');
    assignedDiv.innerHTML = "<h4>Nodes assignés</h4>";
    if (assignmentsForPoly.length > 0) {
      const ul = document.createElement('ul');
      assignmentsForPoly.forEach(a => {
         const nodeInfo = window.globalNodes.find(n => n.device_id === a.device_id) || {};
         const li = document.createElement('li');
         li.innerHTML = `
           Device: ${nodeInfo.name || a.device_id} - Actif: ${a.active ? 'Oui' : 'Non'}
           <br>
           <select id="activation-hour-${a.device_id}-${poly.polygon_id}">
             ${Array.from({ length: 49 }, (_, i) => {
                if (i === 48) return `<option value="${i}">Immédiat</option>`;
                const hours = Math.floor(i / 2);
                const minutes = (i % 2) * 30;
                return `<option value="${i}">${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}</option>`;
             }).join('')}
           </select>
           <button onclick="updateAssignmentWithHour('${a.device_id}', ${poly.polygon_id}, ${a.active ? 2 : 1})">
             ${a.active ? 'Désactiver' : 'Activer'}
           </button>
           <button onclick="updateAssignmentWithHour('${a.device_id}', ${poly.polygon_id}, 3)">Supprimer</button>
         `;
         ul.appendChild(li);
      });
      assignedDiv.appendChild(ul);
    } else {
      assignedDiv.innerHTML += "<p>Aucune assignation</p>";
    }
    assignSection.appendChild(assignedDiv);
  
    // Section pour assigner de nouveaux nodes
    let availableDiv = document.createElement('div');
    availableDiv.innerHTML = "<h4>Nodes disponibles</h4>";
    const availableNodes = window.globalNodes.filter(n =>
      !window.globalAssignments.find(a => a.device_id === n.device_id && a.polygon_id === poly.polygon_id)
    );
    if (availableNodes.length > 0) {
      const form = document.createElement('form');
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
         // Rafraîchir la section d'assignation
         selectPolygon(poly);
      });
      form.appendChild(btnAssign);
      availableDiv.appendChild(form);
    } else {
      availableDiv.innerHTML += "<p>Tous les nodes sont assignés</p>";
    }
    assignSection.appendChild(availableDiv);
  
    sidebar.appendChild(assignSection);
  }
  
  // Lorsqu'un node est sélectionné, on met simplement en surbrillance sur la carte tous les polygones où il est assigné.
  function selectNode(node) {
    resetAllPolygonColors();
    const assignedPolyIds = window.globalAssignments
      .filter(a => a.device_id === node.device_id)
      .map(a => a.polygon_id);
    window.globalGeofences.forEach(poly => {
      if (assignedPolyIds.includes(poly.polygon_id) && poly.layer) {
         poly.layer.setStyle({ color: 'blue' });
      }
    });
    // Ne rien afficher dans la sidebar.
  }
  
  // Fonction d'initialisation globale.
  async function init() {
    await fetchAllNodes();
    await fetchAllPolygons();
    createPolygonLayers();
    renderPolygonList();
    renderNodeList();
  }
  init();
  
  window.fetchPolygons = fetchAllPolygons;
  window.fetchNodes = fetchAllNodes;
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
/* ===============================
   SECTION : Page add-device.html
   (Création de nouveaux devices)
============================== */

document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si le formulaire d'ajout de device existe (cas de add-device.html)
  const deviceForm = document.getElementById('device-form');
  if (deviceForm) {
    deviceForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // Empêche le rechargement de la page
      // Récupérer les valeurs des inputs
      const deviceId = document.getElementById('device_id').value.trim();
      const name = document.getElementById('name').value.trim();
      
      // Vérification simple
      if (!deviceId || !name) {
        document.getElementById('result').textContent = "Veuillez remplir tous les champs.";
        return;
      }

      try {
        // Appel POST vers l'endpoint pour ajouter un device
        const response = await fetch(API_BASE_URL + '/API/add-device', {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ device_id: deviceId, name: name })
        });
        const result = await response.json();
        if (response.ok) {
          document.getElementById('result').textContent = result.message;
          // Optionnel : vider le formulaire
          deviceForm.reset();
        } else {
          document.getElementById('result').textContent = "Erreur : " + result.message;
        }
      } catch (error) {
        console.error("Erreur lors de l'ajout du device :", error);
        document.getElementById('result').textContent = "Erreur lors de l'ajout du device : " + error.message;
      }
    });
  }
});


/* ===============================
   SECTION : Page show_gps_points.html
   (Affichage des positions)
============================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM complètement chargé pour show_gps_points.html");

  // INITIALISATION DE LA CARTE
  const mapDiv = document.getElementById('gps-map');
  if (!mapDiv) {
    console.error("La div avec l'id 'gps-map' est introuvable");
    return;
  }
  console.log("mapDiv trouvé, hauteur:", mapDiv.clientHeight);
  
  const map = L.map('gps-map').setView([46.8, 2.4], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  console.log("Carte Leaflet initialisée");

  // Récupération des éléments de contrôle
  const datePicker = document.getElementById('datePicker');
  const deviceSelector = document.getElementById('deviceSelector');
  const loadMoreButton = document.getElementById('loadMore');
  const positionSlider = document.getElementById('positionSlider');
  const sliderValueSpan = document.getElementById('sliderValue');

  if (!datePicker || !deviceSelector || !loadMoreButton || !positionSlider) {
    console.error("Certains éléments de contrôle sont introuvables");
    return;
  }

  // Variables globales
  let pointsByDevice = {}; // objet: { device_id: [points triés par timestamp décroissant] }
  let globalCursor = null; // pour la pagination globale (si besoin)
  let currentOffset = 0;   // indice de la position affichée par device (0 = position la plus récente)

  // Fonction de récupération des points via API
  async function fetchGPSPoints(initialLoad = false) {
    try {
      // Utiliser la date du sélecteur (ou aujourd'hui)
      const selectedDate = datePicker.value || new Date().toISOString().split("T")[0];
      // Récupération de la liste des devices sélectionnés (si aucun n'est sélectionné, prendre tous les devices)
      const selectedDevices = Array.from(deviceSelector.selectedOptions).map(opt => opt.value);
      
      let url = `${API_BASE_URL}/api/gpspoints?date=${selectedDate}&limit=100`;
      // On peut ajouter éventuellement un paramètre "device_ids" si le backend le supporte.
      // Sinon, on récupère tous les points de la journée et on les filtrera côté client.
      console.log("URL de récupération:", url);
      const response = await fetchData(url);
      console.log("Réponse de fetchGPSPoints:", response);
      if (response && response.data) {
        // Filtrer par device si une sélection existe
        let points = response.data;
        if (selectedDevices.length > 0) {
          points = points.filter(pt => selectedDevices.includes(pt.device_id));
        }
        // Grouper les points par device et trier par timestamp décroissant
        pointsByDevice = points.reduce((acc, pt) => {
          if (!acc[pt.device_id]) acc[pt.device_id] = [];
          acc[pt.device_id].push(pt);
          return acc;
        }, {});
        // Trier chaque tableau par timestamp décroissant
        for (const dev in pointsByDevice) {
          pointsByDevice[dev].sort((a, b) => (new Date(b.timestamp)) - (new Date(a.timestamp)));
        }

        // Mettre à jour le slider : définir la valeur max globale à la plus grande longueur-1
        const maxOffset = Math.max(...Object.values(pointsByDevice).map(arr => arr.length)) - 1;
        positionSlider.max = maxOffset >= 0 ? maxOffset : 0;
        sliderValueSpan.textContent = currentOffset;
        renderMarkers();
      }
    } catch (error) {
      console.error("Erreur lors du chargement des points GPS:", error);
    }
  }

  // Fonction pour afficher les marqueurs pour chaque device selon currentOffset
  function renderMarkers() {
    if (window.markersLayer) {
      window.markersLayer.clearLayers();
    } else {
      window.markersLayer = L.layerGroup().addTo(map);
    }
    // Pour chaque device, afficher le point correspondant à currentOffset (ou le dernier disponible)
    for (const dev in pointsByDevice) {
      const devicePoints = pointsByDevice[dev];
      let pointToShow = devicePoints[currentOffset] || devicePoints[devicePoints.length - 1];
      if (pointToShow) {
        const marker = L.marker([pointToShow.latitude, pointToShow.longitude])
          .bindPopup(`<strong>Device :</strong> ${dev}<br/><strong>Time :</strong> ${pointToShow.timestamp}`);
        window.markersLayer.addLayer(marker);
      }
    }
  }

  // Événement sur le sélecteur de date : recharger les points
  datePicker.addEventListener('change', () => {
    console.log("Date modifiée, rechargement...");
    currentOffset = 0;
    sliderValueSpan.textContent = currentOffset;
    fetchGPSPoints();
  });

  // Événement sur le sélecteur des devices
  deviceSelector.addEventListener('change', () => {
    console.log("Devices modifiés, rechargement...");
    currentOffset = 0;
    sliderValueSpan.textContent = currentOffset;
    fetchGPSPoints();
  });

  // Événement sur le curseur de position
  positionSlider.addEventListener('input', () => {
    currentOffset = parseInt(positionSlider.value, 10);
    sliderValueSpan.textContent = currentOffset;
    renderMarkers();
  });

  // Bouton "Charger plus" si vous souhaitez charger des points à partir d'une pagination (optionnel)
  loadMoreButton.addEventListener('click', () => {
    // Ici, à titre d'exemple, on recharge tout (si vous avez mis en place une pagination sur le backend, adaptez)
    fetchGPSPoints();
  });

  // Chargement initial : définir la date par défaut et lancer la récupération
  if (!datePicker.value) {
    datePicker.value = new Date().toISOString().split("T")[0];
  }
  fetchGPSPoints();

  // Affichage des geofences
  async function fetchGeofences() {
    try {
      const response = await fetchData(`${API_BASE_URL}/API/get-geofences`);
      if (response) {
        // On suppose que le backend renvoie des objets GeoJSON ou compatible.
        // Si 'geometry' ou 'polygon' est dans la réponse, adaptater en conséquence.
        // Ici, on utilise L.geoJSON pour afficher les polygones.
        const geofencesLayer = L.geoJSON(response, {
          style: function(feature) {
            return { color: '#3388ff', weight: 2, opacity: 0.6 };
          },
          onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.name) {
              layer.bindPopup(feature.properties.name);
            }
          }
        }).addTo(map);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des geofences:", err);
    }
  }
  fetchGeofences();
});
