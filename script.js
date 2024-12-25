document.addEventListener('DOMContentLoaded', () => {
  // Gestion des requêtes AJAX
  async function fetchData(url, method = 'GET', body = null) {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });
    return response.json();
  }

  // Afficher les points GPS sur la carte
  if (document.getElementById('gps-map')) {
    const map = L.map('gps-map').setView([48.8566, 2.3522], 13); // Centré sur Paris

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/gps-data').then(data => {
      data.forEach(point => {
        L.marker([point.latitude, point.longitude])
          .addTo(map)
          .bindPopup(`Device ID: ${point.device_id}<br>Timestamp: ${point.timestamp}`)
          .openPopup();
      });
    }).catch(error => {
      console.error('Erreur lors de la récupération des données GPS:', error);
    });
  }

  // Tracer des polygones pour le geofencing
  if (document.getElementById('geofencing-map')) {
    const map = L.map('geofencing-map').setView([48.8566, 2.3522], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (event) {
      const layer = event.layer;
      drawnItems.addLayer(layer);

      const polygonData = {
        name: 'Geofencing Polygon',
        geometry: layer.toGeoJSON().geometry,
      };

      fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', 'POST', polygonData)
        .then(response => {
          alert('Polygone enregistré avec succès!');
        })
        .catch(error => {
          console.error('Erreur lors de l\'enregistrement du polygone:', error);
        });
    });
  }

  // Afficher et gérer les polygones de geofencing
  if (document.getElementById('manage-geofencing-map')) {
    const map = L.map('manage-geofencing-map').setView([48.8566, 2.3522], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing-data').then(data => {
      data.forEach(polygon => {
        const layer = L.geoJSON(polygon.geometry).addTo(map);
        layer.on('click', () => {
          const newValue = !polygon.active; // Inverser la valeur du booléen
          fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/update-geofencing', 'POST', { name: polygon.name, newValue })
            .then(response => {
              alert('Booléen mis à jour avec succès!');
            })
            .catch(error => {
              console.error('Erreur lors de la mise à jour du booléen:', error);
            });
        });
      });
    }).catch(error => {
      console.error('Erreur lors de la récupération des données de geofencing:', error);
    });
  }
});
