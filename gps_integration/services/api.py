import frappe
import struct
from frappe.utils import now
from frappe import _

@frappe.whitelist(allow_guest=True)
def receive_gps_data_via_http(data):
    # Convert the hex string to bytes
    print(data)
    data = bytes.fromhex(data)
    print(data)

    # Parse the data based on Codec8/Codec8 Extended
    try:
        preamble = data[0:4]
        data_length = struct.unpack('>I', data[4:8])[0]
        codec_id = data[8]
        number_of_data_1 = data[9]
        avl_data_array = data[10:-6]
        number_of_data_2 = data[-6]
        crc16 = data[-4:]

        if codec_id == 0x08 or codec_id == 0x8E:  # Codec8 or Codec8 Extended
            latitude, longitude, altitude, speed = parse_gps_data(avl_data_array)
            device_id = parse_device_id(avl_data_array)
            print(latitude)
            print(longitude)
            print(altitude)
            print(speed)
            print(device_id)


            # Store the data in the GPS Log
            oc = frappe.get_doc({
                'doctype': 'GPS Log',
                'data': data.hex(),
                'received_at': now(),
                'latitude': latitude,
                'longitude': longitude,
                'altitude': altitude,
                'speed': speed,
                'device_id': device_id
            })
            print(oc)
            oc.insert()
            oc.save()
            frappe.db.commit()

        return {"status": "success"}

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "GPS Data Parsing Error")
        return {"status": "error", "message": str(e)}

def parse_gps_data(avl_data_array):
    latitude = struct.unpack('>i', avl_data_array[10:14])[0] / 10000000.0
    longitude = struct.unpack('>i', avl_data_array[14:18])[0] / 10000000.0
    altitude = struct.unpack('>h', avl_data_array[18:20])[0]
    speed = struct.unpack('>h', avl_data_array[22:24])[0]
    return latitude, longitude, altitude, speed

def parse_device_id(avl_data_array):
    return avl_data_array[2:10].hex()
