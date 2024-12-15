// gps_integration/public/js/vehicle.js

frappe.ui.form.on('Vehicle', {
    custom_is_in_use: function(frm) {
        // Optionally show a message when tracking is enabled/disabled
        if (frm.doc.custom_is_in_use) {
            frappe.show_alert({
                message: __('GPS Tracking enabled for this vehicle'),
                indicator: 'green'
            });
        } else {
            frappe.show_alert({
                message: __('GPS Tracking disabled for this vehicle'),
                indicator: 'orange'
            });
        }
    }
});