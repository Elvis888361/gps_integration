# gps_integration/gps_integration/api.py

import frappe
from frappe import _
from frappe.core.doctype.sms_settings.sms_settings import send_sms

@frappe.whitelist()
def get_active_vehicles():
    """Get all vehicles with tracking enabled"""
    return frappe.get_all(
        "Vehicle",
        filters={"custom_is_in_use": 1},
        pluck="name"
    )

@frappe.whitelist()
def create_notification_log(subject, message, vehicle, for_user):
    """Create a notification log and send SMS for vehicle tracking updates"""
    # Create notification log
    notification = frappe.get_doc({
        "doctype": "Notification Log",
        "subject": subject,
        "message": message,
        "for_user": for_user,
        "type": "Alert",
        "document_type": "Vehicle",
        "document_name": vehicle,
        "read": 0
    })
    notification.insert(ignore_permissions=True)
    
    # Get vehicle document to get assigned driver
    vehicle_doc = frappe.get_doc("Vehicle", vehicle)
    
    # Get phone numbers for SMS
    recipients = []
    
    # Add driver's phone if available
    if vehicle_doc.driver:
        driver = frappe.get_doc("Driver", vehicle_doc.driver)
        if driver.cell_number:
            recipients.append(driver.cell_number)
    
    # Add user's phone if available
    user = frappe.get_doc("User", for_user)
    if user.mobile_no:
        recipients.append(user.mobile_no)
    
    # Send SMS if recipients exist
    if recipients:
        try:
            send_sms(
                recipients=recipients,
                message=message,
                success_msg=True
            )
            frappe.logger().info(f"SMS sent for vehicle {vehicle} to {', '.join(recipients)}")
        except Exception as e:
            frappe.logger().error(f"SMS sending failed for vehicle {vehicle}: {str(e)}")
    
    # Send email notification if enabled
    if user.send_notifications_email:
        frappe.sendmail(
            recipients=[user.email],
            subject=subject,
            message=message,
            reference_doctype="Vehicle",
            reference_name=vehicle
        )
    
    return notification.name

@frappe.whitelist()
def check_delivery_locations(vehicles, current_lat, current_lon, accuracy=10, speed=0):
    """Check delivery locations for multiple vehicles with enhanced status tracking"""
    if isinstance(vehicles, str):
        vehicles = frappe.parse_json(vehicles)
    
    status_updates = []
    speed = float(speed) if speed else 0
    
    for vehicle in vehicles:
        vehicle_status = {
            "vehicle": vehicle,
            "status": "Moving" if speed > 1 else "Stationary",
            "speed": speed
        }
        
        # Check delivery trips
        delivery_trips = frappe.get_all(
            "Delivery Trip",
            filters={
                "vehicle": vehicle,
                "status": ["in", ["Scheduled", "In Transit"]],
                "docstatus": 1
            },
            fields=["name"]
        )
        
        closest_stop = None
        min_distance = float('inf')
        
        for trip in delivery_trips:
            delivery_stops = frappe.get_all(
                "Delivery Stop",
                filters={"parent": trip.name, "visited": 0},
                fields=["name", "address", "customer"]
            )
            
            for stop in delivery_stops:
                if stop.address:
                    address = frappe.get_doc("Address", stop.address)
                    if address.latitude and address.longitude:
                        distance = calculate_distance(
                            float(current_lat),
                            float(current_lon),
                            float(address.latitude),
                            float(address.longitude)
                        )
                        
                        if distance < min_distance:
                            min_distance = distance
                            closest_stop = {
                                "name": stop.name,
                                "customer": stop.customer,
                                "distance": distance
                            }
        
        if closest_stop:
            vehicle_status.update({
                "customer": closest_stop["customer"],
                "distance": closest_stop["distance"]
            })
            
            if closest_stop["distance"] <= 100:  # Within 100 meters
                frappe.db.set_value("Delivery Stop", closest_stop["name"], "visited", 1)
                vehicle_status["status"] = "Reached"
                
                # Create timeline entry for vehicle
                vehicle_doc = frappe.get_doc("Vehicle", vehicle)
                vehicle_doc.add_comment("Info", 
                    f"Reached delivery location for {closest_stop['customer']}")
                
            elif closest_stop["distance"] > 1000:  # Beyond 1000 meters
                vehicle_status["status"] = "Moving Away"
            elif speed < 1:  # Stopped near delivery point
                vehicle_status["status"] = "Stationary"
        
        status_updates.append(vehicle_status)
    
    return status_updates