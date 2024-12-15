// Copyright (c) 2024, Gps Integration and contributors
// For license information, please see license.txt

frappe.query_reports["Vehicle Tracking Report"] = {
	"filters": [
		{
			"fieldname": "vehicle",
			"label": __("Vehicle"),
			"fieldtype": "Link",
			"options": "Vehicle"
		},
		{
			"fieldname": "driver",
			"label": __("Driver"),
			"fieldtype": "Link",
			"options": "Employee"
		},
		{
			"fieldname": "status",
			"label": __("Status"),
			"fieldtype": "Select",
			"options": "\nMoving\nIdle\nStopped"
		}
		,{
			"fieldname": "chart",
			"label": __("Chart"),
			"fieldtype": "Select",
			"options": ['bar','line','pie']
		}
		// Add more filters as needed
	],

};
