frappe.pages['maps'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Map',
        single_column: true
    });

    // Apply flexbox layout to the main section to include both sidebar and map
    $(wrapper).find('.layout-main-section').css({
        'display': 'flex',
        'height': '100vh', // Full height of the viewport
        'margin': '0',
        'padding': '0'
    });

    // Create a sidebar (Menu) with a search field
    $(wrapper).find('.layout-main-section').append(`
        <div id="sidebar" style="
            width: 250px; 
            background-color: #f8f9fa;
            padding: 20px;
            border-right: 2px solid #ccc; /* Darker border */
            box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
            overflow-y: auto;">
            <h3>Menu</h3>
            <input type="text" id="search-input" placeholder="Search device..." style="
                width: 100%;
                padding: 5px;
                margin-bottom: 10px;
                box-sizing: border-box;">
            <ul id="device-menu" style="list-style-type: none; padding: 0;"></ul>
            <p id="no-results" style="display:none; color: red;">No results found.</p>
        </div>
    `);

    // Create a div for the map and set it to occupy the remaining space
    $(wrapper).find('.layout-main-section').append('<div id="mapid" style="flex-grow: 1; height: 100%;"></div>');

    // Include Leaflet CSS and JS
    frappe.require([
        'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
        'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js'
    ], function() {
        // Initialize the map centered on Kenya with a zoom level
        var map = L.map('mapid').setView([-1.286389, 36.817223], 7); // Nairobi, Kenya coordinates with a zoom level of 7

        // Define the Google Maps tile layers
        var googleRoadmapLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
            attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
        });

        var googleSatelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
            attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
        });

        var googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
            attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
        });

        var googleTerrainLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&key=AIzaSyCGSIHF40hvNBYRqfQ9P9ykV0FoeWgACaY', {
            attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
        });

        // Add the default layer to the map
        googleRoadmapLayer.addTo(map);

        // Add layer control to switch between different views
        var layerControl = L.control.layers({
            'Roadmap': googleRoadmapLayer,
            'Satellite': googleSatelliteLayer,
            'Hybrid': googleHybridLayer,
            'Terrain': googleTerrainLayer
        }).addTo(map);

        // Make the layer control always visible
        $('.leaflet-control-layers').css({
            'max-height': 'none',
            'max-width': 'none'
        });
        $('.leaflet-control-layers-expanded').css({
            'display': 'block'
        });

        // Define the custom car icon
        var carIcon = L.icon({
            iconUrl: '/files/car.png',
            iconSize: [32, 32],       // Size of the icon
            iconAnchor: [16, 10],     // Point of the icon which will correspond to marker's location
        });

        // Fetch data from a custom DocType
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'GPS Log',
                fields: ['name', 'latitude', 'longitude', 'device_id','vehicle', 'modified','received_at'],
                order_by: 'device_id asc, modified desc,received_at desc',
                filters: [
                    ['latitude', '!=', null],
                    ['longitude', '!=', null]
                ],
                limit_page_length: 1000
            },
            callback: function(response) {
                var locations = response.message;
                var latestLocations = {};
                var markers = {};

                // Loop through the records and keep only the latest for each device_id
                locations.forEach(function(location) {
                    if (!latestLocations[location.vehicle]) {
                        latestLocations[location.vehicle] = location;
                    }
                });

                // Now add markers for the latest locations
                Object.keys(latestLocations).forEach(function(device_id) {
                    var location = latestLocations[device_id];
                    if (location.latitude && location.longitude) {
                        var marker = L.marker([location.latitude, location.longitude], { icon: carIcon }).addTo(map);
                        marker.bindPopup(location.vehicle);
                        markers[location.vehicle] = marker;

                        $('#device-menu').append(`
                            <li class="device-item">
                                <a href="#" style="text-decoration: none; color: #000;" 
                                   onclick="focusOnMarker('${location.vehicle}')">
                                   ${location.vehicle}
                                </a>
                            </li>
                        `);
                    } else {
                        console.error('Invalid location data:', location);
                    }
                });

                // Function to focus on a marker and open its popup
                window.focusOnMarker = function(deviceName) {
                    var marker = markers[deviceName];
                    if (marker) {
                        map.setView(marker.getLatLng(), 15);
                        marker.openPopup();
                    }
                };

                // Add event listener to search input
                $('#search-input').on('input', function() {
                    var query = $(this).val().toLowerCase();
                    var hasResults = false;

                    $('.device-item').each(function() {
                        var deviceName = $(this).text().toLowerCase();
                        if (deviceName.includes(query)) {
                            $(this).show();
                            hasResults = true;
                        } else {
                            $(this).hide();
                        }
                    });

                    if (hasResults) {
                        $('#no-results').hide();
                    } else {
                        $('#no-results').show();
                    }
                });
            }
        });
    });
}
