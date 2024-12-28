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

    if (!response.ok) {
      throw new Error(`Erreur HTTP! Statut: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return null;
  }

  function getUrlParams() {
    const params = {};
    const queryString = window.location.search.slice(1);
    const regex = /([^&=]+)=([^&]*)/g;
    let m;
    while ((m = regex.exec(queryString)) !== null) {
      params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }
    return params;
  }

  if (document.getElementById('gps-map')) {
    const params = getUrlParams();
    const latitude = params.lat ? parseFloat(params.lat) : 48.8566;
    const longitude = params.lng ? parseFloat(params.lng) : 2.3522;
    const zoom = params.zoom ? parseInt(params.zoom) : 13;
    const map = L.map('gps-map').setView([latitude, longitude], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/gps-data').then(response => {
      if (response && Array.isArray(response.data)) {
        response.data.forEach(point => {
          var marker = L.marker([point.latitude, point.longitude]).addTo(map);
          marker.bindPopup(`Device ID: ${point.device_id}<br>Timestamp: ${point.timestamp}<br>Geo-fence: ${point.geo_fence_status ? 'Dedans' : 'Dehors'}`);
          marker.on('click', function(e) {
            marker.openPopup();
          });
        });
      } else {
        console.error('Les données GPS ne sont pas au bon format:', response);
      }
    }).catch(error => {
      console.error('Erreur lors de la récupération des données GPS:', error);
    });

    fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing-data').then(response => {
      if (response && Array.isArray(response.data)) {
        response.data.forEach(polygon => {
          if (polygon.active) {
            const latlngs = polygon.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            L.polygon(latlngs, { color: 'red' }).addTo(map);
          }
        });
      } else {
        console.error('Les données de geofencing ne sont pas au bon format:', response);
      }
    }).catch(error => {
      console.error('Erreur lors de la récupération des données de geofencing:', error);
    });
  }

  let drawnPolygon = null;

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
    draw: {
      polygon: true,
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
    },
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function (event) {
    drawnItems.clearLayers();
    drawnPolygon = event.layer;
    drawnItems.addLayer(drawnPolygon);
  });

  document.getElementById('save-polygon').addEventListener('click', () => {
    const polygonName = document.getElementById('polygon-name').value;

    if (drawnPolygon && polygonName) {
      const polygonData = {
        name: polygonName,
        geometry: drawnPolygon.toGeoJSON().geometry,
        active: false // Définir par défaut comme inactif
      };

      fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/save-geofencing', 'POST', polygonData)
        .then(response => {
          if (response) {
            alert('Polygone enregistré avec succès!');
          } else {
            alert('Insertion réussie sans retour de données.');
          }
        })
        .catch(error => {
          console.error('Erreur lors de l\'enregistrement du polygone:', error);
        });
    } else {
      alert('Veuillez tracer un polygone et entrer un nom.');
    }
  });

  document.getElementById('show-gps-button').addEventListener('click', (e) => {
    e.preventDefault();
    const center = map.getCenter();
    const zoom = map.getZoom();
    const url = `show_gps_points.html?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}`;
    window.location.href = url;
  });
}

  if (document.getElementById('manage-geofencing-map')) {
    const map = L.map('manage-geofencing-map').setView([48.8566, 2.3522], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/geofencing-data').then(response => {
      if (response && Array.isArray(response.data)) {
        response.data.forEach(polygon => {
          const color = polygon.active ? 'red' : 'blue';
          const layer = L.geoJSON(polygon.geometry, {
            style: { color: color }
          }).addTo(map);

          layer.on('click', () => {
            const newValue = !polygon.active;
            const popupContent = `
              <div>
                <h3>${polygon.name}</h3>
                <button id="toggle-active">${polygon.active ? 'Désactiver' : 'Activer'}</button>
                <button id="delete-polygon">🗑️</button>
              </div>
            `;

            const popup = L.popup()
              .setLatLng(layer.getBounds().getCenter())
              .setContent(popupContent)
              .openOn(map);

            function updatePopup() {
              const newContent = `
                <div>
                  <h3>${polygon.name}</h3>
                  <button id="toggle-active">${newValue ? 'Désactiver' : 'Activer'}</button>
                  <button id="delete-polygon">🗑️</button>
                </div>
              `;
              popup.setContent(newContent).setLatLng(layer.getBounds().getCenter()).openOn(map);

              document.getElementById('toggle-active').addEventListener('click', toggleActive);
              document.getElementById('delete-polygon').addEventListener('click', deletePolygon);
            }

            function toggleActive() {
              const newValue = !polygon.active;
              console.log('Toggle Active:', { name: polygon.name, newValue });

              fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/update-geofencing', 'POST', { name: polygon.name, newValue })
                .then(response => {
                  alert(`Polygone ${newValue ? 'activé' : 'désactivé'} avec succès!`);
                  polygon.active = newValue;
                  layer.setStyle({ color: newValue ? 'red' : 'blue' });
                  updatePopup();
                })
                .catch(error => {
                  console.error('Erreur lors de la mise à jour du booléen:', error);
                });

              // Réattache les événements après la mise à jour
              document.getElementById('toggle-active').addEventListener('click', toggleActive);
              document.getElementById('delete-polygon').addEventListener('click', deletePolygon);
            }



            function deletePolygon() {
              fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/delete-geofencing', 'POST', { name: polygon.name })
                .then(response => {
                  alert('Polygone supprimé avec succès!');
                  map.removeLayer(layer);
                  map.closePopup(); // Fermer le popup
                })
                .catch(error => {
                  console.error('Erreur lors de la suppression du polygone:', error);
                });
            }

            document.getElementById('toggle-active').addEventListener('click', toggleActive);
            document.getElementById('delete-polygon').addEventListener('click', deletePolygon);
          });
        });
      } else {
        console.error('Les données de geofencing ne sont pas au bon format:', response);
      }
    }).catch(error => {
      console.error('Erreur lors de la récupération des données de geofencing:', error);
    });

    document.getElementById('show-gps-button').addEventListener('click', (e) => {
      e.preventDefault();
      const center = map.getCenter();
      const zoom = map.getZoom();
      const url = `show_gps_points.html?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}`;
      window.location.href = url;
    });
  }
});
