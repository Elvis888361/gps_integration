frappe.pages['device-map'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Device Map',
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

        // Add a tile layer to the map (OpenStreetMap tiles)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

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
			        fields: ['latitude', 'longitude', 'device_id', 'modified'],
			        order_by: 'modified desc', // Order by the latest modified date
			        limit_page_length: 1, // Limit to one record per device
			        filters: [
			            ['latitude', '!=', null],
			            ['longitude', '!=', null]
			        ],
			        group_by: 'device_id' 
            },
            callback: function(response) {
                var locations = response.message;
                var markers = {};

                locations.forEach(function(location) {
                    if (location.latitude && location.longitude) {
                        // Add a marker for each location with the custom car icon
                        var marker = L.marker([location.latitude, location.longitude], { icon: carIcon }).addTo(map);

                        // Bind a popup to the marker with the device name
                        marker.bindPopup(location.device_id);

                        // Store the marker for reference
                        markers[location.device_id] = marker;

                        // Add device name to the sidebar menu
                        $('#device-menu').append(`
                            <li class="device-item">
                                <a href="#" style="text-decoration: none; color: #000;" 
                                   onclick="focusOnMarker('${location.device_id}')">
                                   ${location.device_id}
                                </a>
                            </li>
                        `);

                        console.log(`Marker added at [${location.latitude}, ${location.longitude}] for ${location.device_id}`);
                    } else {
                        console.error('Invalid location data:', location);
                    }
                });

                // Function to focus on a marker and open its popup
                window.focusOnMarker = function(deviceName) {
                    var marker = markers[deviceName];
                    if (marker) {
                        map.setView(marker.getLatLng(), 15); // Zoom in when a marker is selected
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
