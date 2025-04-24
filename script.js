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

// Fonction pour activer/désactiver un polygone avec l’heure sélectionnée
async function updateAssignmentWithHour(device_id, polygon_id, action) {
  const hourSelector = document.getElementById(`activation-hour-${device_id}-${polygon_id}`);
  const selectedHour = parseInt(hourSelector.value, 10); // Récupérer l'heure sélectionnée (0-48)

  console.log(`updateAssignmentWithHour appelée avec device_id=${device_id}, polygon_id=${polygon_id}, action=${action}, heure=${selectedHour}`);
  const payload = {
    action, // 0 = activer, 1 = désactiver
    polygon_id,
    hour: selectedHour, // L'heure encodée dans le payload
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
    alert(`Action envoyée avec succès : ${action === 0 ? 'Activer' : 'Désactiver'}, Heure : ${selectedHour === 48 ? 'Immédiate' : selectedHour}`);
    fetchPolygons(); // Recharger les polygones pour refléter les changements
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'assignation avec heure :', error);
    alert('Erreur lors de la mise à jour.');
  }
}

// Fonction pour supprimer un polygone
async function deleteAssignment(device_id, polygon_id) {
  console.log(`deleteAssignment appelée avec device_id=${device_id}, polygon_id=${polygon_id}`);
  const payload = {
    action: 2, // 2 = supprimer
    polygon_id,
    device_id,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/API/delete-assignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    console.log('Réponse de suppression :', result);
    alert('Suppression envoyée avec succès');
    fetchPolygons(); // Recharger les polygones pour refléter les changements
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'assignation :', error);
    alert('Erreur lors de la suppression.');
  }
}

// Exposer les fonctions globalement
window.updateAssignmentWithHour = updateAssignmentWithHour;
window.deleteAssignment = deleteAssignment;

// -------------------------------
// Gestion des polygones pour manage_geofencing.html
// -------------------------------
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('manage-geofencing-map')) {
    const map = L.map('manage-geofencing-map').setView([48.8566, 2.3522], 13); // Paris par défaut

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Charger les polygones depuis geofences
    async function fetchPolygons() {
      try {
        const geofences = await fetchData(API_BASE_URL + '/API/get-geofences');
        console.log("Polygones reçus:", geofences);

        geofences.forEach(geofence => {
          // Convertir GeoJSON en format Leaflet ([latitude, longitude])
          const leafletCoordinates = geofence.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);

          // Créer et ajouter le polygone à la carte
          const polygon = L.polygon(leafletCoordinates, {
            color: geofence.active ? 'green' : 'red', // Couleur selon l'état (active/inactive)
          }).addTo(map);

          polygon.bindPopup(`<strong>Polygone :</strong> ${geofence.name}`);

          // Ajouter un événement de clic pour récupérer les infos de validation
          polygon.on('click', async () => {
            try {
              const assignments = await fetchData(`${API_BASE_URL}/API/get-polygon-assignments?polygon_id=${geofence.polygon_id}`);
              console.log("Assignments pour le polygone :", geofence.name, assignments);

              let assignmentInfo = `<strong>Polygone :</strong> ${geofence.name}<br><strong>Nodes associés :</strong><ul>`;
              assignments.forEach(assignment => {
                const hourOptions = Array.from({ length: 49 }, (_, i) => {
                  if (i === 48) {
                    return `<option value="${i}">Immédiat</option>`;
                  }
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
                    <button onclick="updateAssignmentWithHour('${assignment.device_id}', ${geofence.polygon_id}, ${assignment.active ? 1 : 0})">
                      ${assignment.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onclick="deleteAssignment('${assignment.device_id}', ${geofence.polygon_id})">Supprimer</button>
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
        console.error('Erreur lors du chargement des polygones :', error);
      }
    }

    fetchPolygons(); // Charger les polygones au démarrage
  }
});
