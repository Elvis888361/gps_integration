(() => {
  // ../gps_integration/gps_integration/public/js/location_tracker.js
  frappe.provide("gps_integration");
  gps_integration.LocationTracker = class LocationTracker {
    constructor() {
      this.activeVehicles = /* @__PURE__ */ new Map();
      this.watchId = null;
      this.tracking = false;
      this.setupTrackingIndicator();
      this.startTracking();
    }
    static getInstance() {
      if (!gps_integration.LocationTracker.instance) {
        gps_integration.LocationTracker.instance = new gps_integration.LocationTracker();
      }
      return gps_integration.LocationTracker.instance;
    }
    setupTrackingIndicator() {
      if (!document.getElementById("tracking-status")) {
        const indicator = document.createElement("div");
        indicator.id = "tracking-status";
        indicator.style.position = "fixed";
        indicator.style.bottom = "20px";
        indicator.style.right = "20px";
        indicator.style.padding = "10px";
        indicator.style.borderRadius = "5px";
        indicator.style.display = "none";
        indicator.style.zIndex = 1e3;
        document.body.appendChild(indicator);
      }
    }
    startTracking() {
      if (!this.tracking && navigator.geolocation) {
        this.tracking = true;
        this.refreshActiveVehicles();
        setInterval(() => this.refreshActiveVehicles(), 6e4);
        this.watchId = navigator.geolocation.watchPosition(
          (position) => this.handlePositionUpdate(position),
          (error) => this.handleError(error),
          {
            enableHighAccuracy: true,
            maximumAge: 3e4,
            timeout: 27e3
          }
        );
      }
    }
    refreshActiveVehicles() {
      frappe.call({
        method: "gps_integration.api.get_active_vehicles",
        callback: (r) => {
          if (r.message) {
            this.updateActiveVehicles(r.message);
          }
        }
      });
    }
    updateActiveVehicles(vehicles) {
      this.activeVehicles.clear();
      vehicles.forEach((vehicle) => {
        this.activeVehicles.set(vehicle, true);
      });
      this.updateIndicator();
    }
    updateIndicator() {
      const indicator = document.getElementById("tracking-status");
      const count = this.activeVehicles.size;
      if (count > 0) {
        indicator.style.display = "block";
        indicator.style.backgroundColor = "#4CAF50";
        indicator.textContent = `Tracking ${count} vehicle(s)`;
      } else {
        indicator.style.display = "none";
      }
    }
    handlePositionUpdate(position) {
      if (this.activeVehicles.size === 0)
        return;
      const currentLat = position.coords.latitude;
      const currentLon = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      const speed = position.coords.speed ? position.coords.speed : 0;
      frappe.call({
        method: "gps_integration.api.check_delivery_locations",
        args: {
          vehicles: Array.from(this.activeVehicles.keys()),
          current_lat: currentLat,
          current_lon: currentLon,
          accuracy,
          speed
        },
        callback: (r) => {
          if (r.message) {
            this.updateTrackingStatus(r.message);
            r.message.forEach((update) => {
              if (update.status === "Reached" || update.status === "Moving Away") {
                this.sendDesktopNotification(update);
              }
            });
          }
        }
      });
    }
    updateTrackingStatus(updates) {
      updates.forEach((update) => {
        let statusColor = "blue";
        let message = "";
        switch (update.status) {
          case "Reached":
            statusColor = "green";
            message = `${update.vehicle}: Reached ${update.customer}`;
            frappe.utils.play_sound("alert");
            break;
          case "Moving Away":
            statusColor = "orange";
            message = `${update.vehicle}: Moving away from ${update.customer} (${Math.round(update.distance)}m)`;
            break;
          case "Stationary":
            statusColor = "yellow";
            message = `${update.vehicle}: Stopped near ${update.customer} (${Math.round(update.distance)}m)`;
            break;
          case "Moving":
            statusColor = "blue";
            message = `${update.vehicle}: Moving at ${Math.round(update.speed * 3.6)}km/h`;
            break;
        }
        frappe.show_alert({
          message,
          indicator: statusColor
        }, 7);
        this.updateDetailedIndicator(updates);
      });
    }
    updateDetailedIndicator(updates) {
      const indicator = document.getElementById("tracking-status");
      if (!indicator)
        return;
      let html = `<div style="font-weight: bold;">Tracking ${this.activeVehicles.size} vehicle(s)</div>`;
      updates.forEach((update) => {
        let statusColor = update.status === "Reached" ? "green" : update.status === "Moving Away" ? "orange" : update.status === "Stationary" ? "yellow" : "blue";
        html += `
                <div style="margin-top: 5px; padding: 5px; border-left: 3px solid ${statusColor};">
                    <div>${update.vehicle}</div>
                    <div style="font-size: 0.9em; color: #666;">
                        ${update.status}
                        ${update.distance ? ` - ${Math.round(update.distance)}m` : ""}
                        ${update.speed ? ` - ${Math.round(update.speed * 3.6)}km/h` : ""}
                    </div>
                </div>
            `;
      });
      indicator.innerHTML = html;
      indicator.style.display = "block";
      indicator.style.backgroundColor = "#fff";
      indicator.style.border = "1px solid #ddd";
      indicator.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      indicator.style.padding = "15px";
      indicator.style.maxWidth = "300px";
    }
    handleError(error) {
      frappe.show_alert({
        message: `Geolocation error: ${error.message}`,
        indicator: "red"
      });
    }
    sendDesktopNotification(update) {
      if (!("Notification" in window)) {
        return;
      }
      if (Notification.permission !== "granted") {
        Notification.requestPermission();
        return;
      }
      let title = "";
      let options = {
        icon: "/assets/gps_integration/images/truck.png",
        body: "",
        tag: update.vehicle
      };
      if (update.status === "Reached") {
        title = `Vehicle Reached Destination`;
        options.body = `${update.vehicle} has reached ${update.customer}`;
      } else if (update.status === "Moving Away") {
        title = `Vehicle Moving Away`;
        options.body = `${update.vehicle} is moving away from ${update.customer} (${Math.round(update.distance)}m)`;
      }
      const notification = new Notification(title, options);
      if (update.status === "Reached") {
        frappe.utils.play_sound("alert");
      }
      frappe.show_alert({
        message: options.body,
        indicator: update.status === "Reached" ? "green" : "orange"
      }, 15);
      frappe.call({
        method: "gps_integration.api.create_notification_log",
        args: {
          subject: title,
          message: options.body,
          vehicle: update.vehicle,
          for_user: frappe.session.user
        }
      });
    }
  };
  $(document).ready(function() {
    gps_integration.tracker = gps_integration.LocationTracker.getInstance();
  });
})();
//# sourceMappingURL=location_tracker.bundle.BBQG2RCE.js.map
