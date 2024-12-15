# Copyright (c) 2024, Gps Integration and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
    columns, data = [], []
    columns = get_columns()
    data = get_data(filters)
    chart = get_chart(data,filters)
    return columns, data, None, chart  # Returning chart along with columns and data

def get_columns():
    return [
        {"label": _("Vehicle"), "fieldname": "vehicle", "fieldtype": "Link", "options": "Vehicle", "width": 150},
        {"label": _("Driver"), "fieldname": "driver", "fieldtype": "Link", "options": "Employee", "width": 150},
        {"label": _("Speed"), "fieldname": "speed", "fieldtype": "Float", "width": 100},
        {"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 100},
        {"label": _("Last Updated"), "fieldname": "modified", "fieldtype": "Datetime", "width": 150},
    ]
def get_data(filters):
    conditions = get_conditions(filters)
    query = """
        SELECT
            v.name as vehicle,
            e.employee_name as driver,
            g.speed,
            CASE
                WHEN g.speed > 5 THEN 'Moving'
                WHEN g.speed > 0 THEN 'Idle'
                ELSE 'Stopped'
            END as status,
            g.modified
        FROM
            `tabGPS Log` g
        JOIN
            `tabVehicle` v ON g.device_id = v.custom_imei_number
        JOIN
            `tabEmployee` e ON v.employee = e.name
        WHERE
            {conditions}
        ORDER BY
            g.modified DESC
    """.format(conditions=conditions)

    # Pass filters as parameters for safe substitution
    return frappe.db.sql(query, filters, as_dict=True)

def get_conditions(filters):
    conditions = "1=1"
    if filters.get("vehicle"):
        conditions += " AND v.name = %(vehicle)s"
    if filters.get("driver"):
        conditions += " AND e.name = %(driver)s"
    if filters.get("status"):
        conditions += """
            AND CASE 
                WHEN g.speed > 5 THEN 'Moving'
                WHEN g.speed > 0 THEN 'Idle'
                ELSE 'Stopped' 
            END = %(status)s
        """
    return conditions


def get_chart(data, filters):
    """Generate chart data for the report."""
    status_counts = {"Moving": 0, "Idle": 0, "Stopped": 0}

    # Extract chart type from filters; default to 'bar'
    chart_type = filters.get("chart") or "bar"

    # Calculate counts for each status
    for row in data:
        if row['status'] in status_counts:
            status_counts[row['status']] += 1

    # Return the chart data
    return {
        "data": {
            "labels": ["Moving", "Idle", "Stopped"],
            "datasets": [
                {
                    "name": _("Vehicle Status"),
                    "values": [status_counts["Moving"], status_counts["Idle"], status_counts["Stopped"]]
                }
            ],
        },
        "type": chart_type,  # Set chart type dynamically based on the filter
        "colors": ["#34a853", "#fbbc05", "#ea4335"],  # Colors for Moving, Idle, Stopped
    }

