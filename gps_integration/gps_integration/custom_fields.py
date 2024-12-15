from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def setup_custom_fields():
    custom_fields = {
        'Vehicle': [
            {
                'fieldname': 'custom_is_in_use',
                'label': 'Enable GPS Tracking',
                'fieldtype': 'Check',
                'insert_after': 'make',
                'description': 'Enable automatic GPS tracking for this vehicle'
            }
        ]
    }
    create_custom_fields(custom_fields)