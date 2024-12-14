import requests
import frappe

@frappe.whitelist()
def get_imei_status(imei_to_search):
    # Define the URL and the headers
    url = "https://api.teltonika.lt/devices"
    headers = {
        "Authorization": "Bearer 4934|tr8BGmOKFItmTg4Hi6YCkXvIwvu3gshRqZ4Bae3B"
    }

    # Send a GET request to the API
    response = requests.get(url, headers=headers)

    # Check if the request was successful
    if response.status_code == 200:
        data = response.json()

        # Search for the specific IMEI in the response data
        for device_info in data['data']:
            if str(device_info['imei']) == str(imei_to_search):
                status = device_info.get('activity_status', 'Unknown')
                return status  # Return the status to the client-side script

        # If the IMEI is not found in the data, return a message
        return f"IMEI: {imei_to_search} not found in the response data."
    else:
        # Return an error message if the API request failed
        frappe.throw(f"Failed to retrieve data. Status code: {response.status_code}")
