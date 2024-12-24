document.addEventListener('DOMContentLoaded', () => {
  const pageTitle = document.title;

  const map = L.map('map').setView([48.8566, 2.3522], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Gestion des polygones
  if (pageTitle === 'Manage Geofencing Polygons') {
    const polygonsListContainer = document.getElementById('polygons-list');

    async function fetchPolygons() {
      try {
        const response = await fetch('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing');
        if (response.ok) {
          const data = await response.json();
          if (data.length === 0) {
            polygonsListContainer.innerHTML = '<p>Aucun polygone disponible.</p>';
          } else {
            displayPolygons(data);
          }
        } else {
          polygonsListContainer.innerHTML = '<p>Erreur lors de la récupération des polygones.</p>';
          console.error('Erreur lors de la récupération des polygones');
        }
      } catch (error) {
        polygonsListContainer.innerHTML = '<p>Erreur de connexion au serveur.</p>';
        console.error('Erreur lors de la récupération des polygones:', error);
      }
    }

    function displayPolygons(polygons) {
      polygonsListContainer.innerHTML = '';

      polygons.forEach(polygon => {
        const polygonName = polygon.name || 'Polygone sans nom';

        const polygonItem = document.createElement('div');
        polygonItem.className = 'polygon-item';

        polygonItem.innerHTML = `
          <span>Nom: ${polygonName}</span>
          <button onclick="activatePolygon('${polygon.id}')">Activer</button>
          <button onclick="deletePolygon('${polygon.id}')">Supprimer</button>
        `;

        if (polygon.polygone && polygon.polygone.type === 'Polygon') {
          const geoJsonLayer = L.geoJSON(polygon.polygone).addTo(map);
          geoJsonLayer.bindPopup(`Nom: ${polygonName}`);
        } else {
          console.error(`Données de polygone non valides pour l'ID ${polygon.id}`);
        }

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
          fetchPolygons();
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
          fetchPolygons();
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
