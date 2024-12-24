document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.title;

  // Initialisation de la carte
  const map = L.map('map').setView([48.8566, 2.3522], 12); // Centré sur Paris

  // Ajouter les tuiles OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  if (pageTitle === 'Manage Geofencing Polygons') {
    // Fonctionnalités pour gérer les polygones
    const polygonsListContainer = document.getElementById('polygons-list');

    async function fetchPolygons() {
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
        if (response.ok) {
          const data = await response.json();
          displayPolygons(data);
        } else {
          console.error('Erreur lors de la récupération des polygones');
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des polygones:', error);
      }
    }

    function displayPolygons(polygons) {
      polygonsListContainer.innerHTML = ''; // Vide la liste existante

      polygons.forEach(polygon => {
        const polygonItem = document.createElement('div');
        polygonItem.className = 'polygon-item';

        // Affiche le nom et un bouton d'activation
        polygonItem.innerHTML = `
          <span>Nom: ${polygon.name}</span>
          <button onclick="activatePolygon('${polygon.id}')">Activer</button>
          <button onclick="deletePolygon('${polygon.id}')">Supprimer</button>
        `;

        // Ajout des coordonnées sur la carte
        const geoJsonLayer = L.geoJSON(polygon.polygone).addTo(map);
        geoJsonLayer.bindPopup(`Nom: ${polygon.name}`);

        polygonsListContainer.appendChild(polygonItem);
      });
    }

    window.activatePolygon = async function (polygonId) {
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/activate-geofencing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: polygonId }),
        });

        if (response.ok) {
          alert('Polygone activé avec succès.');
          fetchPolygons(); // Rafraîchit la liste des polygones
        } else {
          console.error('Erreur lors de l\'activation du polygone');
        }
      } catch (error) {
        console.error('Erreur lors de l\'activation du polygone:', error);
      }
    };

    window.deletePolygon = async function (polygonId) {
      try {
        const response = await fetch(`https://geofencing-8a9755fd6a46.herokuapp.com/API/delete-geofencing/${polygonId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          alert('Polygone supprimé avec succès.');
          fetchPolygons(); // Rafraîchit la liste des polygones
        } else {
          console.error('Erreur lors de la suppression du polygone');
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du polygone:', error);
      }
    };

    fetchPolygons();
  }
});
