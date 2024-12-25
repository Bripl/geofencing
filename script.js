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

    // Vérifie s'il y a un contenu JSON à parser
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return null;
  }

  // Fonction pour obtenir les paramètres URL
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

  // Afficher les points GPS sur la carte
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
          L.marker([point.latitude, point.longitude])
            .addTo(map)
            .bindPopup(`Device ID: ${point.device_id}<br>Timestamp: ${point.timestamp}`)
            .openPopup();
        });
      } else {
        console.error('Les données GPS ne sont pas au bon format:', response);
      }
    }).catch(error => {
      console.error('Erreur lors de la récupération des données GPS:', error);
    });
  }

  // Tracer des polygones pour le geofencing
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
      drawnItems.clearLayers(); // Effacer les polygones précédents
      drawnPolygon = event.layer;
      drawnItems.addLayer(drawnPolygon);
    });

    document.getElementById('save-polygon').addEventListener('click', () => {
      const polygonName = document.getElementById('polygon-name').value;

      if (drawnPolygon && polygonName) {
        const polygonData = {
          name: polygonName,
          geometry: drawnPolygon.toGeoJSON().geometry,
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

  // Afficher et gérer les polygones de geofencing
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
            const newValue = !polygon.active; // Inverser la valeur du booléen
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

            document.getElementById('toggle-active').addEventListener('click', () => {
              fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/update-geofencing', 'POST', { name: polygon.name, newValue })
                .then(response => {
                  alert(`Polygone ${newValue ? 'activé' : 'désactivé'} avec succès!`);
                  layer.setStyle({ color: newValue ? 'red' : 'blue' });
                  // Recharger la carte sans changer le centrage ni le zoom
                  map.setView(layer.getBounds().getCenter(), map.getZoom());
                })
                .catch(error => {
                  console.error('Erreur lors de la mise à jour du booléen:', error);
                });
            });

            document.getElementById('delete-polygon').addEventListener('click', () => {
              fetchData('https://geofencing-8a9755fd6a46.herokuapp.com/API/delete-geofencing', 'POST', { name: polygon.name })
                .then(response => {
                  alert('Polygone supprimé avec succès!');
                  // Supprimer le polygone de la carte sans changer le centrage ni le zoom
                  map.removeLayer(layer);
                })
                .catch(error => {
                  console.error('Erreur lors de la suppression du polygone:', error);
                });
            });
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
