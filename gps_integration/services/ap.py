import frappe
from frappe import _
import socket
import threading
import binascii
import struct
import datetime
from datetime import datetime


port = 8083

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(('', port))

def parse_avl_data(datas):

    data_bytes = bytes.fromhex(datas)
    idx = 0
    idx += 8

    # Codec ID (1 byte)
    codec_id = data_bytes[idx]
    idx += 1

    # Number of Data 1 (1 byte)
    num_records = data_bytes[idx]
    idx += 1

    # Decode only the first record
    record = {}

    # Decode Timestamp (8 bytes)
    timestamp = struct.unpack('>Q', data_bytes[idx:idx+8])[0]
    timestamp_s = timestamp / 1000

    # Convert the timestamp to a datetime object
    dt_object = datetime.fromtimestamp(timestamp_s)

    # Format the datetime object to a readable string
    formatted_date = dt_object.strftime('%Y-%m-%d')
    idx += 8

    # Decode Priority (1 byte)
    priority = data_bytes[idx]
    print(f"Priority: {priority}")
    record['priority'] = priority
    idx += 1

    # Decode GPS Element (15 bytes)
    longitude = struct.unpack('>i', data_bytes[idx:idx+4])[0] / 10000000
    idx += 4
    latitude = struct.unpack('>i', data_bytes[idx:idx+4])[0] / 10000000
    idx += 4
    altitude = struct.unpack('>h', data_bytes[idx:idx+2])[0]
    idx += 2
    angle = struct.unpack('>H', data_bytes[idx:idx+2])[0]
    idx += 2
    satellites = data_bytes[idx]
    idx += 1
    speed = struct.unpack('>H', data_bytes[idx:idx+2])[0]
    idx += 2
    gps_log = frappe.get_doc({
        'doctype': 'GPS Log',
        'device_id': imei,  # Replace with actual device ID
        'longitude': longitude,
        'latitude': latitude,
        'received_at':formatted_date,
        'altitude': altitude,
        'custom_angle': angle,
        'custom_satellites': satellites,
        'speed': speed,
        'data': datas
    })
    gps_log.insert(ignore_permissions=True)
    frappe.db.commit()

    # Decode IO Element
    io_elements = {}

    # Event ID (2 bytes)
    event_id = struct.unpack('>H', data_bytes[idx:idx+2])[0]
    record['event_id'] = event_id
    idx += 2

    # Number of Total IO Elements (1 byte)
    total_io_elements = data_bytes[idx]
    idx += 1

    return record

def handle_client(conn, addr):
    print(f"[NEW CONNECTION] {addr} connected.")

    connected = True

    while connected:
        try:
            imei = conn.recv(1024)
            if not imei:
                break

            message = '\x01'.encode('utf-8')
            conn.send(message)

            data = conn.recv(1024)
            if not data:
                break

            received = binascii.hexlify(data)
            datas = received.decode('utf-8')
            avl_data = parse_avl_data(datas)

            if avl_data:
                response = f"Record received with timestamp: {avl_data['timestamp']}"
                conn.send(response.encode('utf-8'))
            else:
                print("Invalid data received, no AVL data to send back.")

        except socket.error as e:
            print(f"Socket error: {e}")
            break

        except Exception as e:
            print(f"Error Occurred: {e}")
            break

    conn.close()

def start():
    s.listen()
    print("Server is listening ...")
    while True:
        conn, addr = s.accept()
        thread = threading.Thread(target=handle_client, args=(conn, addr))
        thread.start()
        print(f"[ACTIVE CONNECTIONS] {threading.active_count() - 1}")

print("[STARTING] server is starting...")
start()
